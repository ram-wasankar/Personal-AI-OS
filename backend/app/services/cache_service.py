import asyncio
import json
import time
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

try:
    from redis.asyncio import Redis as RedisClient
except Exception:  # pragma: no cover
    RedisClient = None  # type: ignore[assignment]


logger = get_logger(__name__)


class InMemoryTTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            item = self._store.get(key)
            if item is None:
                return None

            expires_at, value = item
            if expires_at < time.time():
                self._store.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        async with self._lock:
            self._store[key] = (time.time() + ttl_seconds, value)

    async def delete_prefix(self, prefix: str) -> None:
        async with self._lock:
            keys = [key for key in self._store if key.startswith(prefix)]
            for key in keys:
                self._store.pop(key, None)


class CacheService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._memory_cache = InMemoryTTLCache()
        self._redis: Any | None = None

    async def initialize(self) -> None:
        if not self.settings.redis_url or RedisClient is None:
            return

        timeout_seconds = max(self.settings.redis_connect_timeout_ms / 1000, 1.0)
        try:
            redis_client = RedisClient.from_url(
                self.settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=timeout_seconds,
                socket_timeout=timeout_seconds,
            )
            await asyncio.wait_for(redis_client.ping(), timeout=timeout_seconds)
            self._redis = redis_client
            logger.info("cache_ready", extra={"event": "cache_ready", "details": "redis"})
        except TimeoutError:
            logger.warning(
                "cache_fallback",
                extra={"event": "cache_fallback", "details": "in-memory due to: redis startup timeout"},
            )
            self._redis = None
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "cache_fallback",
                extra={"event": "cache_fallback", "details": f"in-memory due to: {exc}"},
            )
            self._redis = None

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.close()
        self._redis = None

    async def get(self, key: str) -> Any | None:
        if self._redis is not None:
            raw = await self._redis.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        return await self._memory_cache.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if self._redis is not None:
            await self._redis.set(key, json.dumps(value, default=str), ex=ttl_seconds)
            return
        await self._memory_cache.set(key, value, ttl_seconds)

    async def delete_prefix(self, prefix: str) -> None:
        if self._redis is not None:
            async for key in self._redis.scan_iter(match=f"{prefix}*"):
                await self._redis.delete(key)
            return
        await self._memory_cache.delete_prefix(prefix)


cache_service = CacheService()
