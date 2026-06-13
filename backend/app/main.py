from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from sqlalchemy.exc import SQLAlchemyError

import logging
import time

from app.api import api_router
from app.core.config import get_settings
from app.services.r2_service import get_r2_service

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup - initialize services
    r2 = get_r2_service()
    if r2.is_configured:
        logger.info("R2 storage service initialized (connected)")
    else:
        logger.warning("R2 storage service running in MOCK mode")
    yield
    # Shutdown


app = FastAPI(
    title="Doles Reels Generator",
    description="Internal tool for generating Instagram reels with synced lyrics",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Global Exception Handlers ──────────────────────────────────────


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with user-friendly messages."""
    errors = exc.errors()
    messages = []
    for err in errors:
        field = " -> ".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        msg = err.get("msg", "Invalid value")
        messages.append(f"{field}: {msg}" if field else msg)

    detail = "; ".join(messages) if messages else "Validation error"
    logger.warning(
        "Validation error on %s %s: %s",
        request.method, request.url.path, detail,
    )
    return JSONResponse(
        status_code=422,
        content={"detail": detail},
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database errors gracefully."""
    logger.exception(
        "Database error on %s %s: %s",
        request.method, request.url.path, exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred. Please try again later."},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions. Returns 500 with a generic message."""
    logger.exception(
        "Unhandled error on %s %s: %s",
        request.method, request.url.path, exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# ── Request Logging Middleware ──────────────────────────────────────


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log request method, path, and response time for observability."""
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000

    # Only log API requests, skip static assets
    if request.url.path.startswith("/api"):
        logger.info(
            "%s %s -> %d (%.0fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

    return response


# ── CORS middleware ─────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/api/health")
async def health_check() -> dict:
    r2 = get_r2_service()
    return {
        "status": "ok",
        "service": "doles-reels-generator",
        "r2_configured": r2.is_configured,
    }
