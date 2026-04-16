import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings
from app.db.mongodb import get_documents_collection
from app.models.schemas import DocumentRead
from app.services.cache_service import cache_service
from app.services.ingestion_service import ingestion_service


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)
    return cleaned[:120] if cleaned else "upload.bin"


class DocumentService:
    def __init__(self) -> None:
        self.settings = get_settings()

    @staticmethod
    def _to_read_model(document: dict) -> DocumentRead:
        return DocumentRead(
            id=str(document["_id"]),
            user_id=document["user_id"],
            file_url=document["file_url"],
            file_name=document["file_name"],
            extracted_text=document["extracted_text"],
            status=document["status"],
            chunks=document.get("chunks", 0),
            created_at=document["created_at"],
            size_bytes=document.get("size_bytes", 0),
        )

    async def list_documents(self, user_id: str, skip: int = 0, limit: int = 50) -> list[DocumentRead]:
        collection = get_documents_collection()
        safe_limit = max(1, min(limit, 100))
        safe_skip = max(skip, 0)
        docs = await collection.find({"user_id": user_id}).sort("created_at", -1).skip(safe_skip).limit(safe_limit).to_list(length=safe_limit)
        return [self._to_read_model(doc) for doc in docs]

    async def upload_document(self, user_id: str, filename: str, payload: bytes) -> DocumentRead:
        safe_name = _sanitize_filename(filename)
        extension = Path(safe_name).suffix.lower()
        if extension not in {".pdf", ".txt", ".md"}:
            raise ValueError("Only PDF, TXT, and MD files are supported")

        if len(payload) > self.settings.max_upload_mb * 1024 * 1024:
            raise ValueError(f"File is too large. Max allowed is {self.settings.max_upload_mb}MB")

        unique_name = f"{uuid4().hex}_{safe_name}"
        save_path = self.settings.uploads_dir / unique_name
        save_path.write_bytes(payload)

        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "file_url": f"/uploads/{unique_name}",
            "file_name": safe_name,
            "file_type": extension,
            "extracted_text": "",
            "status": "uploading",
            "chunks": 0,
            "created_at": now,
            "updated_at": now,
            "size_bytes": len(payload),
        }

        collection = get_documents_collection()
        result = await collection.insert_one(doc)
        doc_id = str(result.inserted_id)
        doc["_id"] = result.inserted_id
        await ingestion_service.enqueue(user_id=user_id, document_id=doc_id)

        await cache_service.delete_prefix(f"dashboard:{user_id}")

        return self._to_read_model(doc)


document_service = DocumentService()
