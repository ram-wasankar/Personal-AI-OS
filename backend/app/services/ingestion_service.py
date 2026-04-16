import asyncio
import io
from dataclasses import dataclass
from pathlib import Path

from bson import ObjectId
from pypdf import PdfReader

from app.core.logging import get_logger
from app.core.config import get_settings
from app.db.mongodb import get_documents_collection
from app.services.cache_service import cache_service
from app.services.rag_service import rag_service


logger = get_logger(__name__)


@dataclass
class IngestionTask:
    user_id: str
    document_id: str


class IngestionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._queue: asyncio.Queue[IngestionTask] = asyncio.Queue()
        self._worker: asyncio.Task | None = None
        self._running = False

    @staticmethod
    def _extract_text(file_type: str, file_bytes: bytes) -> str:
        if file_type in {".txt", ".md"}:
            return file_bytes.decode("utf-8", errors="ignore")

        if file_type == ".pdf":
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(pages).strip()
            return text if text else "(No text extracted from PDF)"

        return ""

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._worker = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        self._running = False
        if self._worker is not None:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
        self._worker = None

    async def enqueue(self, user_id: str, document_id: str) -> None:
        await self._queue.put(IngestionTask(user_id=user_id, document_id=document_id))

    async def _worker_loop(self) -> None:
        while self._running:
            task = await self._queue.get()
            try:
                await self._process(task)
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "document_ingestion_failed",
                    extra={
                        "event": "document_ingestion_failed",
                        "user_id": task.user_id,
                        "details": str(exc),
                    },
                )
            finally:
                self._queue.task_done()

    async def _process(self, task: IngestionTask) -> None:
        collection = get_documents_collection()
        object_id = ObjectId(task.document_id)
        document = await collection.find_one({"_id": object_id, "user_id": task.user_id})
        if not document:
            return

        await collection.update_one({"_id": object_id}, {"$set": {"status": "processing"}})

        try:
            file_url = document.get("file_url", "")
            file_path = self.settings.uploads_dir / Path(file_url).name
            file_bytes = file_path.read_bytes()

            file_type = document.get("file_type", "")
            extracted_text = self._extract_text(file_type, file_bytes)

            chunks = rag_service.add_source(
                user_id=task.user_id,
                source_type="document",
                source_id=task.document_id,
                source_label=f"Document: {document.get('file_name', 'file')}",
                text=extracted_text,
                doc_type=document.get("file_type", "unknown"),
            )

            await collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "status": "ready",
                        "chunks": chunks,
                        "extracted_text": extracted_text,
                    }
                },
            )
            await cache_service.delete_prefix(f"retrieval:{task.user_id}")
            await cache_service.delete_prefix(f"dashboard:{task.user_id}")
        except Exception as exc:  # noqa: BLE001
            await collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "status": "failed",
                        "processing_error": str(exc),
                    }
                },
            )
            await cache_service.delete_prefix(f"dashboard:{task.user_id}")
            raise

        logger.info(
            "document_ingested",
            extra={
                "event": "document_ingested",
                "user_id": task.user_id,
                "details": {"document_id": task.document_id, "chunks": chunks},
            },
        )


ingestion_service = IngestionService()
