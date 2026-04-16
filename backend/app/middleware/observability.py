import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

from app.core.logging import get_logger


logger = get_logger(__name__)


async def request_timing_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    started_at = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
        logger.info(
            "api_request",
            extra={
                "event": "api_request",
                "path": request.url.path,
                "method": request.method,
                "status_code": status_code,
                "latency_ms": elapsed_ms,
            },
        )
