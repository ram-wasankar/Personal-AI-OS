from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.models.schemas import DocumentRead
from app.services.document_service import document_service


router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentRead])
async def get_documents(
    user: dict = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[DocumentRead]:
    return await document_service.list_documents(str(user["_id"]), skip=skip, limit=limit)
