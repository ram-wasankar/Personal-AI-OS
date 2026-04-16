from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.mongodb import close_mongo, init_mongo
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

    await init_mongo()
    await cache_service.initialize()
    await ingestion_service.start()
    yield
    await ingestion_service.stop()
    await cache_service.close()
    await close_mongo()


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
logger = get_logger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
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
