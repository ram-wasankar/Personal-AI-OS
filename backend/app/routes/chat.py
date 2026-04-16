import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.dependencies.auth import get_current_user
from app.models.schemas import ChatRequest, ChatResponse
from app.services.chat_service import chat_service


router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, user: dict = Depends(get_current_user)) -> ChatResponse:
    return await chat_service.chat(
        user_id=str(user["_id"]),
        query=payload.query,
        conversation_id=payload.conversation_id,
        source_types=payload.source_types,
        document_type=payload.document_type,
    )


@router.post("/stream")
async def stream_chat(payload: ChatRequest, user: dict = Depends(get_current_user)) -> StreamingResponse:
    async def event_generator():
        async for event in chat_service.stream_chat(
            user_id=str(user["_id"]),
            query=payload.query,
            conversation_id=payload.conversation_id,
            source_types=payload.source_types,
            document_type=payload.document_type,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
