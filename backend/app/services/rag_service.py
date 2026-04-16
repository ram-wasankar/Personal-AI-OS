import json
import time
from datetime import datetime, timezone
from threading import RLock
from typing import Any, TYPE_CHECKING

import faiss
import numpy as np

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.cache_service import cache_service
from app.utils.chunking import bm25_like_score, chunk_text


logger = get_logger(__name__)


class RagService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._model: Any | None = None
        self._index: faiss.IndexFlatIP | None = None
        self._metadata: list[dict] = []
        self._embedding_cache: dict[str, tuple[float, np.ndarray]] = {}
        self._embedding_cache_ttl = self.settings.embedding_cache_ttl_seconds
        self._retrieval_version = 0
        self._lock = RLock()
        self._initialize_storage()
        self._load_state()

    def _initialize_storage(self) -> None:
        self.settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.settings.faiss_index_path.parent.mkdir(parents=True, exist_ok=True)

    def _load_model(self) -> Any:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.settings.embedding_model)
        return self._model

    def _load_state(self) -> None:
        meta_path = self.settings.faiss_meta_path
        if not meta_path.exists():
            self._metadata = []
            self._index = None
            return

        try:
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            self._metadata = []
            self._index = None
            return

        self._metadata = payload.get("entries", [])

        if self._metadata:
            embeddings = np.array([item["embedding"] for item in self._metadata], dtype=np.float32)
            self._index = faiss.IndexFlatIP(embeddings.shape[1])
            self._index.add(embeddings)

    def _persist(self) -> None:
        meta_payload = {"entries": self._metadata}
        self.settings.faiss_meta_path.write_text(json.dumps(meta_payload), encoding="utf-8")

        if self._index is not None:
            faiss.write_index(self._index, str(self.settings.faiss_index_path))

    def _cache_key(self, text: str) -> str:
        return f"emb::{hash(text)}"

    def _get_cached_embedding(self, text: str) -> np.ndarray | None:
        key = self._cache_key(text)
        cached = self._embedding_cache.get(key)
        if not cached:
            return None

        expires_at, value = cached
        if expires_at < time.time():
            self._embedding_cache.pop(key, None)
            return None
        return value

    def _set_cached_embedding(self, text: str, value: np.ndarray) -> None:
        key = self._cache_key(text)
        self._embedding_cache[key] = (time.time() + self._embedding_cache_ttl, value)

    @staticmethod
    def _semantic_normalize(score: float) -> float:
        return max(0.0, min((score + 1.0) / 2.0, 1.0))

    @staticmethod
    def _recency_boost(created_at: str | None) -> float:
        if not created_at:
            return 0.0
        try:
            created = datetime.fromisoformat(created_at)
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
        except ValueError:
            return 0.0

        delta_hours = (datetime.now(timezone.utc) - created).total_seconds() / 3600
        if delta_hours < 0:
            delta_hours = 0
        return float(np.exp(-delta_hours / 168))

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 384), dtype=np.float32)

        resolved: list[np.ndarray | None] = [None] * len(texts)
        missing_positions: list[int] = []
        missing_texts: list[str] = []

        for index, text in enumerate(texts):
            cached = self._get_cached_embedding(text)
            if cached is not None:
                resolved[index] = cached
            else:
                missing_positions.append(index)
                missing_texts.append(text)

        if missing_texts:
            model = self._load_model()
            generated = np.array(model.encode(missing_texts, normalize_embeddings=True), dtype=np.float32)
            for relative_index, absolute_index in enumerate(missing_positions):
                vector = generated[relative_index]
                resolved[absolute_index] = vector
                self._set_cached_embedding(texts[absolute_index], vector)

        final_vectors = np.array([vector for vector in resolved if vector is not None], dtype=np.float32)
        return final_vectors

    def add_source(
        self,
        *,
        user_id: str,
        source_type: str,
        source_id: str,
        source_label: str,
        text: str,
        doc_type: str | None = None,
    ) -> int:
        chunks = chunk_text(text, self.settings.rag_chunk_size, self.settings.rag_chunk_overlap)
        if not chunks:
            return 0

        vectors = self.embed_texts(chunks)

        with self._lock:
            if self._index is None:
                self._index = faiss.IndexFlatIP(vectors.shape[1])

            self._index.add(vectors)
            now = datetime.now(timezone.utc).isoformat()

            for idx, chunk in enumerate(chunks):
                self._metadata.append(
                    {
                        "user_id": user_id,
                        "source_type": source_type,
                        "source_id": source_id,
                        "source_label": source_label,
                        "doc_type": doc_type,
                        "chunk": chunk,
                        "embedding": vectors[idx].tolist(),
                        "created_at": now,
                    }
                )

            self._retrieval_version += 1
            self._persist()

        return len(chunks)

    def remove_source(self, *, user_id: str, source_type: str, source_id: str) -> None:
        with self._lock:
            filtered = [
                item
                for item in self._metadata
                if not (
                    item["user_id"] == user_id
                    and item["source_type"] == source_type
                    and item["source_id"] == source_id
                )
            ]

            if len(filtered) == len(self._metadata):
                return

            self._metadata = filtered
            if self._metadata:
                vectors = np.array([item["embedding"] for item in self._metadata], dtype=np.float32)
                self._index = faiss.IndexFlatIP(vectors.shape[1])
                self._index.add(vectors)
            else:
                self._index = None

            self._retrieval_version += 1
            self._persist()

    def _filter_candidate(self, metadata: dict, user_id: str, source_types: set[str] | None, doc_type: str | None) -> bool:
        if metadata.get("user_id") != user_id:
            return False
        if source_types and metadata.get("source_type") not in source_types:
            return False
        if doc_type and metadata.get("doc_type") not in {doc_type, None}:
            return False
        return True

    async def query_hybrid(
        self,
        *,
        user_id: str,
        query_text: str,
        top_k: int | None = None,
        source_types: list[str] | None = None,
        doc_type: str | None = None,
    ) -> list[dict]:
        started = time.perf_counter()
        requested_top_k = top_k or self.settings.rag_top_k
        source_type_set = set(source_types) if source_types else None
        cache_key = (
            f"retrieval:{user_id}:{self._retrieval_version}:{requested_top_k}:"
            f"{','.join(sorted(source_type_set)) if source_type_set else 'all'}:{doc_type or 'all'}:{hash(query_text)}"
        )

        cached = await cache_service.get(cache_key)
        if cached is not None:
            return cached

        with self._lock:
            if self._index is None or not self._metadata:
                return []

            candidate_pool = min(max(requested_top_k * 10, requested_top_k), len(self._metadata))
            query_vector = self.embed_texts([query_text])
            scores, indexes = self._index.search(query_vector, candidate_pool)

            semantic_candidates: list[dict[str, Any]] = []
            for score, idx in zip(scores[0], indexes[0], strict=False):
                if idx < 0:
                    continue
                metadata = self._metadata[idx]
                if not self._filter_candidate(metadata, user_id, source_type_set, doc_type):
                    continue
                semantic_candidates.append(
                    {
                        "key": f"{metadata['source_id']}::{idx}",
                        "source_id": metadata["source_id"],
                        "source_type": metadata["source_type"],
                        "label": metadata["source_label"],
                        "excerpt": metadata["chunk"],
                        "semantic_score": float(score),
                        "keyword_score": 0.0,
                        "created_at": metadata.get("created_at"),
                    }
                )

            keyword_candidates: list[dict[str, Any]] = []
            for idx, metadata in enumerate(self._metadata):
                if not self._filter_candidate(metadata, user_id, source_type_set, doc_type):
                    continue
                keyword_score = bm25_like_score(query_text, metadata.get("chunk", ""))
                if keyword_score <= 0:
                    continue
                keyword_candidates.append(
                    {
                        "key": f"{metadata['source_id']}::{idx}",
                        "source_id": metadata["source_id"],
                        "source_type": metadata["source_type"],
                        "label": metadata["source_label"],
                        "excerpt": metadata["chunk"],
                        "semantic_score": 0.0,
                        "keyword_score": keyword_score,
                        "created_at": metadata.get("created_at"),
                    }
                )

        keyword_candidates.sort(key=lambda item: item["keyword_score"], reverse=True)
        keyword_candidates = keyword_candidates[: max(requested_top_k * 6, requested_top_k)]

        merged: dict[str, dict[str, Any]] = {}
        for candidate in semantic_candidates + keyword_candidates:
            existing = merged.get(candidate["key"])
            if not existing:
                merged[candidate["key"]] = candidate
                continue

            existing["semantic_score"] = max(existing["semantic_score"], candidate["semantic_score"])
            existing["keyword_score"] = max(existing["keyword_score"], candidate["keyword_score"])

        all_candidates = list(merged.values())
        max_keyword = max((item["keyword_score"] for item in all_candidates), default=1.0)

        reranked: list[dict] = []
        for item in all_candidates:
            semantic_norm = self._semantic_normalize(item["semantic_score"])
            keyword_norm = (item["keyword_score"] / max_keyword) if max_keyword > 0 else 0.0
            recency = self._recency_boost(item.get("created_at"))
            final_score = (0.62 * semantic_norm) + (0.28 * keyword_norm) + (0.10 * recency)

            reranked.append(
                {
                    "source_id": item["source_id"],
                    "source_type": item["source_type"],
                    "label": item["label"],
                    "score": float(final_score),
                    "confidence": float(max(0.0, min(final_score, 1.0))),
                    "semantic_score": float(semantic_norm),
                    "keyword_score": float(keyword_norm),
                    "excerpt": item["excerpt"],
                }
            )

        reranked.sort(key=lambda candidate: candidate["score"], reverse=True)
        results = reranked[:requested_top_k]

        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "rag_query",
            extra={
                "event": "rag_query",
                "user_id": user_id,
                "latency_ms": latency_ms,
                "details": {
                    "query_length": len(query_text),
                    "chunks_retrieved": len(results),
                    "semantic_candidates": len(semantic_candidates),
                    "keyword_candidates": len(keyword_candidates),
                },
            },
        )

        await cache_service.set(cache_key, results, self.settings.retrieval_cache_ttl_seconds)
        return results


rag_service = RagService()
