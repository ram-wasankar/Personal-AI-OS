import re
import time
from datetime import datetime, timezone

import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.mongodb import get_memory_collection
from app.models.schemas import MemoryRead
from app.services.rag_service import rag_service


PERSONAL_PATTERN = re.compile(
    r"\b(i|my|mine|we|our|prefer|need|goal|working on|interested|focus|usually|often)\b",
    re.IGNORECASE,
)

logger = get_logger(__name__)


class MemoryService:
    def __init__(self) -> None:
        self.settings = get_settings()

    @staticmethod
    def _infer_memory_type(content: str) -> str:
        lowered = content.lower()
        if any(word in lowered for word in ["prefer", "like", "dislike", "want"]):
            return "preference"
        if any(word in lowered for word in ["usually", "often", "every", "daily", "night"]):
            return "habit"
        if any(word in lowered for word in ["interested", "exploring", "learning", "research"]):
            return "interest"
        return "knowledge"

    @staticmethod
    def _base_importance(content: str) -> float:
        score = 0.25
        score += min(len(content) / 250, 0.25)

        lowered = content.lower()
        keywords = ["goal", "deadline", "prefer", "important", "need", "working on"]
        score += sum(0.08 for token in keywords if token in lowered)

        return float(min(score, 1.0))

    def _decayed_importance(self, importance: float, last_accessed: datetime, frequency: int) -> float:
        if last_accessed.tzinfo is None:
            last_accessed = last_accessed.replace(tzinfo=timezone.utc)

        age_hours = max((datetime.now(timezone.utc) - last_accessed).total_seconds() / 3600, 0)
        half_life = max(self.settings.memory_decay_half_life_hours, 1)
        recency_decay = float(np.exp(-np.log(2) * age_hours / half_life))
        frequency_boost = min(np.log1p(max(frequency, 1)) / np.log(10), 1.2)
        return float(max(0.0, min(importance * recency_decay * frequency_boost, 1.0)))

    @staticmethod
    def _cluster_id(content: str) -> str:
        tokens = [token for token in re.split(r"\W+", content.lower()) if len(token) >= 4]
        if not tokens:
            return "general"
        return "cluster_" + "_".join(tokens[:2])

    @staticmethod
    def _extract_candidate_facts(text: str) -> list[str]:
        segments = re.split(r"(?<=[.!?])\s+|\n+", text)
        candidates: list[str] = []
        for segment in segments:
            cleaned = segment.strip(" -\t")
            if len(cleaned) < 20 or len(cleaned) > 280:
                continue
            if not PERSONAL_PATTERN.search(cleaned):
                continue
            candidates.append(cleaned)
        return candidates[:8]

    @staticmethod
    def _to_memory_read(memory_doc: dict) -> MemoryRead:
        return MemoryRead(
            id=str(memory_doc["_id"]),
            user_id=memory_doc["user_id"],
            content=memory_doc["content"],
            importance_score=float(memory_doc["importance_score"]),
            last_accessed=memory_doc["last_accessed"],
            memory_type=memory_doc["memory_type"],
        )

    async def save_interaction_memories(self, user_id: str, query: str, answer: str) -> None:
        started = time.perf_counter()
        collection = get_memory_collection()
        combined_text = f"{query}\n{answer}"
        facts = self._extract_candidate_facts(combined_text)
        if not facts:
            return

        now = datetime.now(timezone.utc)
        existing_docs = await collection.find({"user_id": user_id}).to_list(length=500)
        existing_texts = [doc["content"] for doc in existing_docs]
        existing_vectors = rag_service.embed_texts(existing_texts) if existing_texts else np.zeros((0, 384), dtype=np.float32)

        new_vectors = rag_service.embed_texts(facts)

        upserts = 0
        updates = 0

        for fact_index, fact in enumerate(facts):
            base_importance = self._base_importance(fact)
            memory_type = self._infer_memory_type(fact)
            cluster_id = self._cluster_id(fact)
            existing = await collection.find_one({"user_id": user_id, "content": fact})

            if existing is None and len(existing_docs) > 0:
                similarities = existing_vectors @ new_vectors[fact_index]
                closest_idx = int(np.argmax(similarities))
                closest_score = float(similarities[closest_idx])
                if closest_score >= 0.92:
                    existing = existing_docs[closest_idx]

            if existing:
                frequency = int(existing.get("frequency", 1)) + 1
                blended_importance = min(
                    1.0,
                    (0.7 * float(existing.get("importance_score", 0.0))) + (0.3 * base_importance),
                )
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "importance_score": blended_importance,
                            "last_accessed": now,
                            "memory_type": memory_type,
                            "cluster_id": existing.get("cluster_id") or cluster_id,
                        }
                        ,
                        "$inc": {"frequency": 1},
                    },
                )
                updates += 1
                continue

            await collection.insert_one(
                {
                    "user_id": user_id,
                    "content": fact,
                    "importance_score": base_importance,
                    "last_accessed": now,
                    "created_at": now,
                    "memory_type": memory_type,
                    "frequency": 1,
                    "cluster_id": cluster_id,
                }
            )
            upserts += 1

        logger.info(
            "memory_upsert",
            extra={
                "event": "memory_upsert",
                "user_id": user_id,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                "details": {"inserted": upserts, "updated": updates},
            },
        )

    async def list_memories(self, user_id: str, limit: int = 100) -> list[MemoryRead]:
        collection = get_memory_collection()
        docs = await collection.find({"user_id": user_id}).to_list(length=500)

        ranked = sorted(
            docs,
            key=lambda item: self._decayed_importance(
                float(item.get("importance_score", 0.0)),
                item.get("last_accessed", datetime.now(timezone.utc)),
                int(item.get("frequency", 1)),
            ),
            reverse=True,
        )
        return [self._to_memory_read(doc) for doc in ranked[:limit]]

    async def retrieve_relevant_memories(self, user_id: str, query: str, limit: int = 4) -> list[dict]:
        started = time.perf_counter()
        collection = get_memory_collection()
        docs = await collection.find({"user_id": user_id}).to_list(length=350)

        if not docs:
            logger.info(
                "memory_retrieval",
                extra={
                    "event": "memory_retrieval",
                    "user_id": user_id,
                    "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                    "details": {"hits": 0, "misses": 1},
                },
            )
            return []

        texts = [doc["content"] for doc in docs]
        vectors = rag_service.embed_texts(texts)
        query_vec = rag_service.embed_texts([query])[0]

        similarities = vectors @ query_vec
        rankings: list[tuple[int, float]] = []

        for idx, sim in enumerate(similarities.tolist()):
            importance = self._decayed_importance(
                float(docs[idx].get("importance_score", 0.0)),
                docs[idx].get("last_accessed", datetime.now(timezone.utc)),
                int(docs[idx].get("frequency", 1)),
            )
            blended = (0.68 * sim) + (0.22 * importance) + (0.10 * min(int(docs[idx].get("frequency", 1)) / 5, 1))
            rankings.append((idx, blended))

        rankings.sort(key=lambda item: item[1], reverse=True)
        selected = rankings[:limit]

        now = datetime.now(timezone.utc)
        ids = [docs[idx]["_id"] for idx, _ in selected]
        if ids:
            await collection.update_many({"_id": {"$in": ids}}, {"$set": {"last_accessed": now}})

        results: list[dict] = []
        for idx, score in selected:
            doc = docs[idx]
            results.append(
                {
                    "source_id": str(doc["_id"]),
                    "source_type": "memory",
                    "label": f"Memory: {doc['memory_type']}",
                    "score": float(score),
                    "confidence": float(max(0.0, min(score, 1.0))),
                    "excerpt": doc["content"],
                    "cluster_id": doc.get("cluster_id", "general"),
                }
            )

        logger.info(
            "memory_retrieval",
            extra={
                "event": "memory_retrieval",
                "user_id": user_id,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                "details": {"hits": len(results), "misses": max(len(docs) - len(results), 0)},
            },
        )

        return results


memory_service = MemoryService()
