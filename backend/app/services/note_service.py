from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.db.mongodb import get_notes_collection
from app.models.schemas import NoteCreate, NoteRead, NoteUpdate
from app.core.logging import get_logger
from app.services.cache_service import cache_service
from app.services.rag_service import rag_service


logger = get_logger(__name__)


class NoteService:
    @staticmethod
    def _to_object_id(value: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid note id") from exc

    @staticmethod
    def _to_note_read(note_doc: dict) -> NoteRead:
        return NoteRead(
            id=str(note_doc["_id"]),
            user_id=note_doc["user_id"],
            title=note_doc["title"],
            content=note_doc["content"],
            created_at=note_doc["created_at"],
        )

    async def list_notes(self, user_id: str, skip: int = 0, limit: int = 50) -> list[NoteRead]:
        notes = get_notes_collection()
        safe_limit = max(1, min(limit, 100))
        safe_skip = max(skip, 0)
        docs = await notes.find({"user_id": user_id}).sort("created_at", -1).skip(safe_skip).limit(safe_limit).to_list(length=safe_limit)
        return [self._to_note_read(doc) for doc in docs]

    async def create_note(self, user_id: str, payload: NoteCreate) -> NoteRead:
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "title": payload.title.strip(),
            "content": payload.content.strip(),
            "created_at": now,
            "updated_at": now,
        }

        notes = get_notes_collection()
        result = await notes.insert_one(doc)
        note_id = str(result.inserted_id)

        try:
            rag_service.add_source(
                user_id=user_id,
                source_type="note",
                source_id=note_id,
                source_label=f"Note: {doc['title']}",
                text=doc["content"],
                doc_type="note",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "note_indexing_degraded",
                extra={
                    "event": "note_indexing_degraded",
                    "user_id": user_id,
                    "details": str(exc),
                },
            )

        await cache_service.delete_prefix(f"dashboard:{user_id}")
        await cache_service.delete_prefix(f"retrieval:{user_id}")

        doc["_id"] = result.inserted_id
        return self._to_note_read(doc)

    async def update_note(self, user_id: str, note_id: str, payload: NoteUpdate) -> NoteRead:
        notes = get_notes_collection()
        note = await notes.find_one({"_id": self._to_object_id(note_id), "user_id": user_id})
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

        update_payload: dict = {"updated_at": datetime.now(timezone.utc)}
        if payload.title is not None:
            update_payload["title"] = payload.title.strip()
        if payload.content is not None:
            update_payload["content"] = payload.content.strip()

        await notes.update_one({"_id": note["_id"]}, {"$set": update_payload})
        note.update(update_payload)

        try:
            rag_service.remove_source(user_id=user_id, source_type="note", source_id=note_id)
            rag_service.add_source(
                user_id=user_id,
                source_type="note",
                source_id=note_id,
                source_label=f"Note: {note['title']}",
                text=note["content"],
                doc_type="note",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "note_reindexing_degraded",
                extra={
                    "event": "note_reindexing_degraded",
                    "user_id": user_id,
                    "details": str(exc),
                },
            )

        await cache_service.delete_prefix(f"dashboard:{user_id}")
        await cache_service.delete_prefix(f"retrieval:{user_id}")

        return self._to_note_read(note)

    async def delete_note(self, user_id: str, note_id: str) -> None:
        notes = get_notes_collection()
        result = await notes.delete_one({"_id": self._to_object_id(note_id), "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

        try:
            rag_service.remove_source(user_id=user_id, source_type="note", source_id=note_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "note_deindexing_degraded",
                extra={
                    "event": "note_deindexing_degraded",
                    "user_id": user_id,
                    "details": str(exc),
                },
            )
        await cache_service.delete_prefix(f"dashboard:{user_id}")
        await cache_service.delete_prefix(f"retrieval:{user_id}")


note_service = NoteService()
