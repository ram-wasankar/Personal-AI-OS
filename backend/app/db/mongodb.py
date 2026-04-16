from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.core.config import get_settings


_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None
_indexes_ready: bool = False


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def init_mongo() -> None:
    global _client, _database

    settings = get_settings()
    timeout_ms = max(int(settings.mongo_connect_timeout_ms), 1000)
    _client = AsyncIOMotorClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=timeout_ms,
        connectTimeoutMS=timeout_ms,
        socketTimeoutMS=timeout_ms,
    )
    _database = _client[settings.mongo_db]


async def warmup_mongo() -> None:
    global _indexes_ready

    if _client is None:
        return

    await _client.admin.command("ping")
    if not _indexes_ready:
        await ensure_indexes()
        _indexes_ready = True


async def close_mongo() -> None:
    global _client, _database
    if _client is not None:
        _client.close()
    _client = None
    _database = None


def get_database() -> AsyncIOMotorDatabase:
    if _database is None:
        raise RuntimeError("MongoDB is not initialized")
    return _database


def get_users_collection():
    return get_database()["users"]


def get_notes_collection():
    return get_database()["notes"]


def get_documents_collection():
    return get_database()["documents"]


def get_conversations_collection():
    return get_database()["conversations"]


def get_memory_collection():
    return get_database()["memory"]


async def ensure_indexes() -> None:
    users = get_users_collection()
    notes = get_notes_collection()
    documents = get_documents_collection()
    conversations = get_conversations_collection()
    memory = get_memory_collection()

    await users.create_index([("email", ASCENDING)], unique=True)

    await notes.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await documents.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await conversations.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
    await memory.create_index([("user_id", ASCENDING), ("importance_score", DESCENDING)])
    await memory.create_index([("user_id", ASCENDING), ("content", ASCENDING)], unique=True)

    await conversations.update_many({"created_at": {"$exists": False}}, {"$set": {"created_at": _utc_now()}})
