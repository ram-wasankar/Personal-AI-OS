import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.mongodb import close_mongo, init_mongo, warmup_mongo
from app.middleware.observability import request_timing_middleware
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.dashboard import router as dashboard_router
from app.routes.documents import router as documents_router
from app.routes.memory import router as memory_router
from app.routes.notes import router as notes_router
from app.routes.upload import router as upload_router
from app.services.cache_service import cache_service
from app.services.ingestion_service import ingestion_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    mongo_warmup_task: asyncio.Task | None = None

    try:
        await init_mongo()
        mongo_warmup_task = asyncio.create_task(
            asyncio.wait_for(warmup_mongo(), timeout=max(settings.mongo_connect_timeout_ms / 1000, 3))
        )
    except TimeoutError:
        logger.warning(
            "startup_degraded_mongo_timeout",
            extra={
                "event": "startup_degraded_mongo_timeout",
                "details": "MongoDB connection timed out during startup; service is running in degraded mode",
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "startup_degraded_mongo_unavailable",
            extra={
                "event": "startup_degraded_mongo_unavailable",
                "details": f"MongoDB unavailable during startup: {exc}",
            },
        )

    try:
        await asyncio.wait_for(cache_service.initialize(), timeout=max(settings.redis_connect_timeout_ms / 1000, 2))
    except TimeoutError:
        logger.warning(
            "startup_degraded_cache_timeout",
            extra={
                "event": "startup_degraded_cache_timeout",
                "details": "Redis initialization timed out during startup; using in-memory cache",
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "startup_degraded_cache_unavailable",
            extra={
                "event": "startup_degraded_cache_unavailable",
                "details": f"Cache initialization unavailable during startup: {exc}",
            },
        )

    await ingestion_service.start()
    yield
    if mongo_warmup_task is not None:
        mongo_warmup_task.cancel()
        try:
            await mongo_warmup_task
        except asyncio.CancelledError:
            pass
        except Exception:  # noqa: BLE001
            pass

    await ingestion_service.stop()
    await cache_service.close()
    await close_mongo()


settings = get_settings()
settings.uploads_dir.mkdir(parents=True, exist_ok=True)
app = FastAPI(title=settings.app_name, lifespan=lifespan)
logger = get_logger(__name__)

allow_credentials = "*" not in settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(request_timing_middleware)

app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

api_prefix = settings.api_prefix
app.include_router(auth_router, prefix=api_prefix)
app.include_router(notes_router, prefix=api_prefix)
app.include_router(upload_router, prefix=api_prefix)
app.include_router(chat_router, prefix=api_prefix)
app.include_router(memory_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(documents_router, prefix=api_prefix)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    logger.warning(
        "http_exception",
        extra={
            "event": "http_exception",
            "status_code": exc.status_code,
            "details": exc.detail,
        },
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception", extra={"event": "unhandled_exception", "details": str(exc)})
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
