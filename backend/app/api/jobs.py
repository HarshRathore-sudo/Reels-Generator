"""Job status API for polling Celery task progress.

Frontend polls this endpoint to track async operations like
transcription, rendering, etc.
"""

from fastapi import APIRouter, HTTPException
from app.workers.celery_app import celery_app

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str) -> dict:
    """Get the status of an async job (Celery task).

    Returns:
        {
            "job_id": "...",
            "status": "queued|running|complete|failed",
            "progress": 0-100,
            "message": "...",
            "result": {...} | null
        }
    """
    task = celery_app.AsyncResult(job_id)

    if task.state == "PENDING":
        # Task hasn't started or doesn't exist
        return {
            "job_id": job_id,
            "status": "queued",
            "progress": 0,
            "message": "Waiting to start...",
            "result": None,
        }

    elif task.state == "STARTED":
        return {
            "job_id": job_id,
            "status": "running",
            "progress": 5,
            "message": "Task started...",
            "result": None,
        }

    elif task.state == "PROGRESS":
        # Custom state with progress info
        meta = task.info or {}
        return {
            "job_id": job_id,
            "status": "running",
            "progress": meta.get("progress", 0),
            "message": meta.get("message", "Processing..."),
            "result": None,
        }

    elif task.state == "SUCCESS":
        return {
            "job_id": job_id,
            "status": "complete",
            "progress": 100,
            "message": "Complete",
            "result": task.result,
        }

    elif task.state == "FAILURE":
        error_msg = str(task.info) if task.info else "Unknown error"
        return {
            "job_id": job_id,
            "status": "failed",
            "progress": 0,
            "message": error_msg,
            "result": None,
        }

    elif task.state == "REVOKED":
        return {
            "job_id": job_id,
            "status": "failed",
            "progress": 0,
            "message": "Task was cancelled",
            "result": None,
        }

    else:
        # Any other state
        meta = task.info if isinstance(task.info, dict) else {}
        return {
            "job_id": job_id,
            "status": "running",
            "progress": meta.get("progress", 0),
            "message": meta.get("message", f"State: {task.state}"),
            "result": None,
        }
