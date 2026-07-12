from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import datasets, health, run
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(run.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")

register_exception_handlers(app)


@app.get("/")
def root() -> dict:
    logger.info("Request to root")
    return {"name": settings.app_name, "docs": "/docs", "environment": settings.environment}
