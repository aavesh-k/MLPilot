from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    """Domain error that maps to a clean JSON error response."""

    def __init__(self, status_code: int, detail: str, *, code: str | None = None) -> None:
        self.status_code = status_code
        self.detail = detail
        self.code = code
        super().__init__(detail)


def _payload(detail: str, code: str | None = None) -> dict:
    return {"error": {"detail": detail, "code": code}}


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    logger.warning("AppError %s: %s", exc.status_code, exc.detail)
    return JSONResponse(status_code=exc.status_code, content=_payload(exc.detail, exc.code))


async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("Validation failed: %s", exc.errors())
    return JSONResponse(status_code=422, content=_payload("Validation failed", "validation_error"))


async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_payload(str(exc.detail)))


async def unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content=_payload("Internal server error", "internal_error"))


def register_exception_handlers(app) -> None:
    """Register consistent JSON error responses for the whole app."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(Exception, unhandled_handler)
