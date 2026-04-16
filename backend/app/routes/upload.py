from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.logging import get_logger
from app.dependencies.auth import get_current_user
from app.models.schemas import DocumentRead
from app.services.document_service import document_service


router = APIRouter(tags=["upload"])
logger = get_logger(__name__)


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(file: UploadFile = File(...), user: dict = Depends(get_current_user)) -> DocumentRead:
    payload = await file.read()

    try:
        return await document_service.upload_document(str(user["_id"]), file.filename or "upload.pdf", payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("upload_failed", extra={"event": "upload_failed", "details": str(exc)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Upload failed") from exc
