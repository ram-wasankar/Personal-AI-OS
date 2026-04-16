import json
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"


class Settings(BaseSettings):
    app_name: str = "Synapse Keeper API"
    api_prefix: str = "/api"
    app_env: str = Field(default="development", alias="APP_ENV")

    mongo_uri: str = Field(alias="MONGO_URI")
    mongo_db: str = Field(default="synapse_keeper", alias="MONGO_DB")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")

    embedding_model: str = Field(default="sentence-transformers/all-MiniLM-L6-v2", alias="EMBEDDING_MODEL")
    rag_chunk_size: int = Field(default=700, alias="RAG_CHUNK_SIZE")
    rag_chunk_overlap: int = Field(default=120, alias="RAG_CHUNK_OVERLAP")
    rag_top_k: int = Field(default=5, alias="RAG_TOP_K")

    retrieval_cache_ttl_seconds: int = Field(default=120, alias="RETRIEVAL_CACHE_TTL_SECONDS")
    embedding_cache_ttl_seconds: int = Field(default=3600, alias="EMBEDDING_CACHE_TTL_SECONDS")
    dashboard_cache_ttl_seconds: int = Field(default=45, alias="DASHBOARD_CACHE_TTL_SECONDS")

    memory_decay_half_life_hours: int = Field(default=72, alias="MEMORY_DECAY_HALF_LIFE_HOURS")
    memory_top_k: int = Field(default=5, alias="MEMORY_TOP_K")

    redis_url: str | None = Field(default=None, alias="REDIS_URL")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8080", "http://127.0.0.1:8080"],
        alias="CORS_ORIGINS",
    )

    max_upload_mb: int = Field(default=25, alias="MAX_UPLOAD_MB")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        enable_decoding=False,
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except json.JSONDecodeError:
                    pass

            return [item.strip() for item in raw.split(",") if item.strip()]

        if isinstance(value, (list, tuple, set)):
            return [str(item).strip() for item in value if str(item).strip()]

        return value

    @property
    def faiss_index_path(self) -> Path:
        return STORAGE_DIR / "faiss.index"

    @property
    def faiss_meta_path(self) -> Path:
        return STORAGE_DIR / "faiss_meta.json"

    @property
    def uploads_dir(self) -> Path:
        return UPLOADS_DIR


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
