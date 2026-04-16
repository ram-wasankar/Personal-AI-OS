from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.models.schemas import MemoryRead
from app.services.memory_service import memory_service


router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", response_model=list[MemoryRead])
async def get_memory(
    user: dict = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[MemoryRead]:
    memories = await memory_service.list_memories(str(user["_id"]), limit=skip + limit)
    return memories[skip: skip + limit]
