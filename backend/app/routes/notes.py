from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import get_current_user
from app.models.schemas import NoteCreate, NoteRead, NoteUpdate
from app.services.note_service import note_service


router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteRead])
async def get_notes(
    user: dict = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[NoteRead]:
    return await note_service.list_notes(str(user["_id"]), skip=skip, limit=limit)


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate, user: dict = Depends(get_current_user)) -> NoteRead:
    return await note_service.create_note(str(user["_id"]), payload)


@router.put("/{note_id}", response_model=NoteRead)
async def update_note(note_id: str, payload: NoteUpdate, user: dict = Depends(get_current_user)) -> NoteRead:
    return await note_service.update_note(str(user["_id"]), note_id, payload)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: str, user: dict = Depends(get_current_user)) -> None:
    await note_service.delete_note(str(user["_id"]), note_id)
