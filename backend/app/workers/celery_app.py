from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "doles_reels",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=3,
    task_track_started=True,
    task_acks_late=False,
    worker_prefetch_multiplier=4,
)

# Auto-discover tasks from worker modules
celery_app.autodiscover_tasks([
    "app.workers.transcription_worker",
    "app.workers.pool_builder_worker",
    "app.workers.render_worker",
])
