import asyncio
from collections import defaultdict

from app.core.config import get_settings
from app.db.mongodb import (
    get_conversations_collection,
    get_documents_collection,
    get_memory_collection,
    get_notes_collection,
)
from app.models.schemas import ActivityItem, DashboardResponse, TopicDistributionItem
from app.services.cache_service import cache_service
from app.utils.time import humanize_timestamp


class DashboardService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def get_dashboard(self, user_id: str) -> DashboardResponse:
        cache_key = f"dashboard:{user_id}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return DashboardResponse.model_validate(cached)

        notes_collection = get_notes_collection()
        documents_collection = get_documents_collection()
        conversations_collection = get_conversations_collection()
        memory_collection = get_memory_collection()

        (
            notes_count,
            docs_count,
            convo_count,
            memory_count,
            recent_notes,
            recent_docs,
            recent_convos,
            memory_docs,
        ) = await asyncio.gather(
            notes_collection.count_documents({"user_id": user_id}),
            documents_collection.count_documents({"user_id": user_id}),
            conversations_collection.count_documents({"user_id": user_id}),
            memory_collection.count_documents({"user_id": user_id}),
            notes_collection.find({"user_id": user_id}).sort("created_at", -1).to_list(length=4),
            documents_collection.find({"user_id": user_id}).sort("created_at", -1).to_list(length=4),
            conversations_collection.find({"user_id": user_id}).sort("updated_at", -1).to_list(length=4),
            memory_collection.find({"user_id": user_id}).to_list(length=200),
        )

        timeline: list[dict] = []
        for note in recent_notes:
            timeline.append(
                {
                    "ts": note["created_at"],
                    "item": ActivityItem(
                        type="note",
                        detail=note["title"],
                        time=humanize_timestamp(note["created_at"]),
                        accent="primary",
                    ),
                }
            )

        for doc in recent_docs:
            timeline.append(
                {
                    "ts": doc["created_at"],
                    "item": ActivityItem(
                        type="document",
                        detail=doc["file_name"],
                        time=humanize_timestamp(doc["created_at"]),
                        accent="warning",
                    ),
                }
            )

        for convo in recent_convos:
            first_user_message = next((m for m in convo.get("messages", []) if m.get("role") == "user"), None)
            label = (first_user_message or {}).get("content", "Chat session")[:70]
            timeline.append(
                {
                    "ts": convo["updated_at"],
                    "item": ActivityItem(
                        type="chat",
                        detail=label,
                        time=humanize_timestamp(convo["updated_at"]),
                        accent="accent",
                    ),
                }
            )

        timeline.sort(key=lambda item: item["ts"], reverse=True)
        recent_activity = [item["item"] for item in timeline[:6]]

        category_keywords = {
            "AI & Machine Learning": ["ai", "ml", "embedding", "rag", "llm", "vector"],
            "System Design": ["architecture", "distributed", "database", "system", "scaling"],
            "Product Strategy": ["roadmap", "feature", "product", "strategy", "user"],
            "Personal Development": ["habit", "learning", "goal", "routine", "focus"],
        }
        bucket = defaultdict(int)

        scan_texts: list[str] = [note.get("content", "") for note in recent_notes]
        scan_texts.extend(doc.get("extracted_text", "") for doc in recent_docs)

        for text in scan_texts:
            lowered = text.lower()
            for topic, keywords in category_keywords.items():
                bucket[topic] += sum(lowered.count(keyword) for keyword in keywords)

        if not bucket:
            bucket["AI & Machine Learning"] = 1

        total = sum(bucket.values()) or 1
        topic_distribution = [
            TopicDistributionItem(name=topic, count=count, pct=max(1, int((count / total) * 100)))
            for topic, count in sorted(bucket.items(), key=lambda pair: pair[1], reverse=True)
        ]

        memory_confidence = 0.0
        if memory_docs:
            memory_confidence = (sum(float(item.get("importance_score", 0.0)) for item in memory_docs) / len(memory_docs)) * 100

        insights: list[str] = []
        if notes_count + docs_count == 0:
            insights.append("Add notes or upload documents to start building your retrievable knowledge base.")
        if notes_count > docs_count:
            insights.append("Your knowledge base is note-heavy. Upload reference documents for better retrieval quality.")
        if convo_count > 0:
            insights.append("Conversation history is now persisted and used for better contextual responses.")
        if memory_count > 0:
            insights.append("Memory extraction is active and influencing chat context selection.")

        if not insights:
            insights.append("System is initialized. Start by creating a note or uploading your first document.")

        response = DashboardResponse(
            summary={
                "notes": notes_count,
                "documents": docs_count,
                "conversations": convo_count,
                "memories": memory_count,
            },
            insights=insights,
            recent_activity=recent_activity,
            topic_distribution=topic_distribution[:4],
            memory_confidence=round(memory_confidence, 2),
        )

        await cache_service.set(
            cache_key,
            response.model_dump(mode="json", by_alias=True),
            self.settings.dashboard_cache_ttl_seconds,
        )
        return response


dashboard_service = DashboardService()
