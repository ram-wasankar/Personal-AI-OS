from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def to_camel(value: str) -> str:
    pieces = value.split("_")
    return pieces[0] + "".join(word.capitalize() for word in pieces[1:])


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class UserCreate(APIModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(APIModel):
    email: EmailStr
    password: str


class UserPublic(APIModel):
    id: str
    email: EmailStr


class AuthResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class NoteCreate(APIModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)


class NoteUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)


class NoteRead(APIModel):
    id: str
    user_id: str
    title: str
    content: str
    created_at: datetime


class DocumentRead(APIModel):
    id: str
    user_id: str
    file_url: str
    file_name: str
    extracted_text: str
    status: Literal["uploading", "processing", "ready", "failed", "indexed", "pending"]
    chunks: int
    created_at: datetime
    size_bytes: int


class SourceItem(APIModel):
    source_id: str
    source_type: Literal["note", "document", "memory"]
    label: str
    score: float
    confidence: float | None = None
    semantic_score: float | None = None
    keyword_score: float | None = None
    excerpt: str


class ChatRequest(APIModel):
    query: str = Field(min_length=1)
    conversation_id: str | None = None
    source_types: list[Literal["note", "document"]] | None = None
    document_type: str | None = None


class ChatResponse(APIModel):
    answer: str
    sources: list[SourceItem]
    conversation_id: str
    memory_hits: int = 0


class MemoryRead(APIModel):
    id: str
    user_id: str
    content: str
    importance_score: float
    last_accessed: datetime
    memory_type: Literal["interest", "habit", "preference", "knowledge"]


class ActivityItem(APIModel):
    type: str
    detail: str
    time: str
    accent: Literal["primary", "accent", "warning", "success"]


class TopicDistributionItem(APIModel):
    name: str
    count: int
    pct: int


class DashboardResponse(APIModel):
    summary: dict[str, int]
    insights: list[str]
    recent_activity: list[ActivityItem]
    topic_distribution: list[TopicDistributionItem]
    memory_confidence: float
