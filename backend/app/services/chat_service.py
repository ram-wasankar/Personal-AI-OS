from datetime import datetime, timezone
from typing import AsyncGenerator

from bson import ObjectId
from fastapi import HTTPException, status
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.mongodb import get_conversations_collection
from app.models.schemas import ChatResponse, SourceItem
from app.services.cache_service import cache_service
from app.services.memory_service import memory_service
from app.services.rag_service import rag_service


logger = get_logger(__name__)


class ChatService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._openai_client = AsyncOpenAI(api_key=self.settings.openai_api_key) if self.settings.openai_api_key else None

    @staticmethod
    def _serialize_source(item: dict) -> SourceItem:
        return SourceItem(
            source_id=item["source_id"],
            source_type=item["source_type"],
            label=item["label"],
            score=float(item["score"]),
            confidence=float(item.get("confidence")) if item.get("confidence") is not None else None,
            semantic_score=float(item.get("semantic_score")) if item.get("semantic_score") is not None else None,
            keyword_score=float(item.get("keyword_score")) if item.get("keyword_score") is not None else None,
            excerpt=item["excerpt"],
        )

    async def chat(
        self,
        *,
        user_id: str,
        query: str,
        conversation_id: str | None,
        source_types: list[str] | None = None,
        document_type: str | None = None,
    ) -> ChatResponse:
        conversations = get_conversations_collection()
        now = datetime.now(timezone.utc)

        conversation_doc = None
        if conversation_id:
            try:
                convo_object_id = ObjectId(conversation_id)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation id") from exc

            conversation_doc = await conversations.find_one({"_id": convo_object_id, "user_id": user_id})

        if not conversation_doc:
            new_doc = {
                "user_id": user_id,
                "messages": [],
                "created_at": now,
                "updated_at": now,
            }
            result = await conversations.insert_one(new_doc)
            conversation_doc = {**new_doc, "_id": result.inserted_id}
            conversation_id = str(result.inserted_id)

        try:
            rag_sources = await rag_service.query_hybrid(
                user_id=user_id,
                query_text=query,
                top_k=self.settings.rag_top_k,
                source_types=source_types or ["note", "document"],
                doc_type=document_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "chat_retrieval_degraded",
                extra={
                    "event": "chat_retrieval_degraded",
                    "user_id": user_id,
                    "details": str(exc),
                },
            )
            rag_sources = []

        try:
            memory_sources = await memory_service.retrieve_relevant_memories(
                user_id=user_id,
                query=query,
                limit=self.settings.memory_top_k,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "chat_memory_retrieval_degraded",
                extra={
                    "event": "chat_memory_retrieval_degraded",
                    "user_id": user_id,
                    "details": str(exc),
                },
            )
            memory_sources = []

        history = conversation_doc.get("messages", [])[-8:]
        answer = await self._generate_answer(query=query, history=history, rag_sources=rag_sources, memory_sources=memory_sources)

        message_history = conversation_doc.get("messages", [])
        message_history.append({"role": "user", "content": query, "created_at": now.isoformat()})
        message_history.append(
            {
                "role": "assistant",
                "content": answer,
                "created_at": now.isoformat(),
                "sources": [item["label"] for item in rag_sources + memory_sources],
            }
        )

        await conversations.update_one(
            {"_id": conversation_doc["_id"]},
            {"$set": {"messages": message_history, "updated_at": now}},
        )

        try:
            await memory_service.save_interaction_memories(user_id=user_id, query=query, answer=answer)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "chat_memory_save_degraded",
                extra={
                    "event": "chat_memory_save_degraded",
                    "user_id": user_id,
                    "details": str(exc),
                },
            )
        await cache_service.delete_prefix(f"dashboard:{user_id}")

        combined_sources = [self._serialize_source(item) for item in rag_sources + memory_sources]
        return ChatResponse(
            answer=answer,
            sources=combined_sources,
            conversation_id=conversation_id,
            memory_hits=len(memory_sources),
        )

    async def stream_chat(
        self,
        *,
        user_id: str,
        query: str,
        conversation_id: str | None,
        source_types: list[str] | None = None,
        document_type: str | None = None,
    ) -> AsyncGenerator[dict, None]:
        response = await self.chat(
            user_id=user_id,
            query=query,
            conversation_id=conversation_id,
            source_types=source_types,
            document_type=document_type,
        )

        if self._openai_client is None:
            chunk_size = 42
            for start in range(0, len(response.answer), chunk_size):
                yield {"type": "token", "content": response.answer[start : start + chunk_size]}
            yield {
                "type": "done",
                "conversation_id": response.conversation_id,
                "sources": [source.model_dump(by_alias=True) for source in response.sources],
                "memory_hits": response.memory_hits,
            }
            return

        # Keep persisted response from chat(), but stream it token-like for client UX.
        for token in response.answer.split():
            yield {"type": "token", "content": token + " "}

        yield {
            "type": "done",
            "conversation_id": response.conversation_id,
            "sources": [source.model_dump(by_alias=True) for source in response.sources],
            "memory_hits": response.memory_hits,
        }

    async def _generate_answer(
        self,
        *,
        query: str,
        history: list[dict],
        rag_sources: list[dict],
        memory_sources: list[dict],
    ) -> str:
        history_text = "\n".join(f"{msg['role']}: {msg['content']}" for msg in history)
        rag_context = "\n\n".join(
            f"[{idx + 1}] {item['label']} (confidence={item.get('confidence', item.get('score', 0)):.2f})\n{item['excerpt']}"
            for idx, item in enumerate(rag_sources)
        )
        memory_context = "\n".join(
            f"- ({item.get('cluster_id', 'cluster')}) {item['excerpt']}"
            for item in memory_sources
        )

        system_prompt = (
            "You are Synapse Keeper assistant. Answer using the provided context and memory. "
            "If context is insufficient, state that clearly. Keep answers concise and technical when possible."
        )

        user_prompt = (
            f"Conversation history:\n{history_text or '(none)'}\n\n"
            f"Relevant memories:\n{memory_context or '(none)'}\n\n"
            f"Retrieved context:\n{rag_context or '(none)'}\n\n"
            f"User question: {query}"
        )

        logger.info(
            "chat_prompt_context",
            extra={
                "event": "chat_prompt_context",
                "details": {
                    "history_items": len(history),
                    "rag_items": len(rag_sources),
                    "memory_items": len(memory_sources),
                },
            },
        )

        if self._openai_client is None:
            if rag_sources:
                bullet_points = "\n".join(f"- {item['excerpt'][:220]}" for item in rag_sources[:3])
                return (
                    "I answered using retrieved context from your notes and documents:\n"
                    f"{bullet_points}\n\n"
                    "Set OPENAI_API_KEY to enable full LLM generation on top of this retrieval pipeline."
                )
            return (
                "I could not find relevant indexed context for this question yet. "
                "Add notes or upload documents, then ask again."
            )

        completion = await self._openai_client.chat.completions.create(
            model=self.settings.openai_model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = completion.choices[0].message.content
        if not content:
            return "I could not generate a response."
        return content.strip()


chat_service = ChatService()
