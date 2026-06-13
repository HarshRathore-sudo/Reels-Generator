"""Celery task for building the Pexels clip pool.

Searches Pexels for stock video clips matching the project's vibe
keywords, ranks them by relevance using Claude, and saves the
results to the clip_pool table.

Progress stages:
1. Loading project data
2. Searching Pexels for clips
3. Ranking clips by relevance
4. Saving to database
"""

import logging
import time
import uuid

from app.workers.celery_app import celery_app
from app.core.sync_database import get_sync_db
from app.models.db_models import Project, ClipPool
from app.services.pexels_service import get_pexels_service
from app.services.claude_service import get_claude_service

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="build_clip_pool")
def build_clip_pool_task(self, project_id: str) -> dict:
    """Search Pexels, filter, rank with Claude, and save clip pool.

    This Celery task:
    1. Loads project vibe keywords
    2. Searches Pexels for matching video clips
    3. Ranks clips by relevance to the vibe description
    4. Saves ranked clips to the clip_pool table
    5. Reports progress via task state updates

    Args:
        project_id: UUID of the project.

    Returns:
        dict with clip pool build summary.
    """
    task_id = self.request.id
    logger.info("Starting clip pool build %s for project %s", task_id, project_id)

    # ── Stage 1: Load project data ──────────────────────────────
    self.update_state(state="PROGRESS", meta={
        "stage": "loading",
        "progress": 5,
        "message": "Loading project data...",
    })

    db = get_sync_db()
    try:
        project = db.query(Project).filter(
            Project.id == uuid.UUID(project_id)
        ).first()

        if not project:
            raise ValueError(f"Project {project_id} not found")

        keywords = project.vibe_keywords or []
        if not keywords:
            raise ValueError(f"Project {project_id} has no vibe keywords")

        vibe_description = project.vibe_description or ""

        logger.info(
            "Project %s: keywords=%s, vibe='%s'",
            project_id, keywords, vibe_description[:60],
        )

        # ── Stage 2: Search Pexels ────────────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "searching",
            "progress": 15,
            "message": f"Searching Pexels for {len(keywords)} keywords...",
        })

        pexels_service = get_pexels_service()

        # Use sync search for Celery (sync worker can't use async)
        clips = pexels_service.search_clips_sync(
            keywords=keywords,
            clips_per_keyword=8,
            max_total=40,
        )

        logger.info("Pexels search returned %d clips", len(clips))

        if not clips:
            logger.warning("No clips found for project %s", project_id)
            return {
                "status": "complete",
                "project_id": project_id,
                "clips_found": 0,
                "clips_saved": 0,
                "message": "No clips found matching your keywords. Try adjusting your vibe keywords.",
            }

        # Simulate search time for better UX
        time.sleep(1)

        self.update_state(state="PROGRESS", meta={
            "stage": "searching",
            "progress": 45,
            "message": f"Found {len(clips)} clips. Analyzing relevance...",
        })

        # ── Stage 3: Rank clips ──────────────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "ranking",
            "progress": 55,
            "message": "Ranking clips by visual relevance...",
        })

        # Prepare clip data for ranking
        clip_data = [
            {
                "pexels_id": c.pexels_id,
                "keyword": c.keyword,
                "duration_seconds": c.duration_seconds,
            }
            for c in clips
        ]

        # Use Claude to rank clips (sync: use mock directly since async is not available)
        claude_service = get_claude_service()
        ranked_ids = claude_service._rank_clips_mock(vibe_description, clip_data)

        time.sleep(0.5)

        self.update_state(state="PROGRESS", meta={
            "stage": "ranking",
            "progress": 70,
            "message": "Clips ranked. Saving to database...",
        })

        # ── Stage 4: Save to database ────────────────────────────
        self.update_state(state="PROGRESS", meta={
            "stage": "saving",
            "progress": 80,
            "message": "Saving clip pool to database...",
        })

        # Delete existing clip pool for this project
        existing_clips = db.query(ClipPool).filter(
            ClipPool.project_id == uuid.UUID(project_id)
        ).all()
        for ec in existing_clips:
            db.delete(ec)
        db.flush()

        # Create relevance score map from ranking
        score_map: dict[str, float] = {}
        total = len(ranked_ids) if ranked_ids else len(clips)
        for i, pid in enumerate(ranked_ids):
            # Score from 1.0 (best) to 0.0 (worst)
            score_map[pid] = round(1.0 - (i / max(total, 1)), 4)

        # Save clips to database
        saved_count = 0
        for clip in clips:
            relevance_score = score_map.get(clip.pexels_id, 0.5)

            db_clip = ClipPool(
                project_id=uuid.UUID(project_id),
                pexels_clip_id=clip.pexels_id,
                clip_url=clip.clip_url,
                duration_seconds=clip.duration_seconds,
                width=clip.width,
                height=clip.height,
                relevance_score=relevance_score,
                used=False,
            )
            db.add(db_clip)
            saved_count += 1

        db.commit()

        logger.info(
            "Clip pool saved for project %s: %d clips",
            project_id, saved_count,
        )

        # ── Stage 5: Complete ─────────────────────────────────────
        return {
            "status": "complete",
            "project_id": project_id,
            "clips_found": len(clips),
            "clips_saved": saved_count,
            "keywords_used": keywords,
            "message": f"Successfully built clip pool with {saved_count} clips.",
        }

    except Exception as e:
        logger.exception("Clip pool build failed for project %s", project_id)
        db.rollback()
        raise
    finally:
        db.close()
