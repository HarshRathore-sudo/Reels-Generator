"""Pexels API service for stock video search.

Searches the Pexels video API for vertical/portrait clips matching
keywords extracted from the project's vibe description.

Filters applied:
- Orientation: portrait (vertical) preferred
- Duration: 10 seconds minimum
- Quality: HD (1080p+)
- Returns up to 40 clips across all keywords

Supports mock mode when PEXELS_API_KEY is not configured.
"""

import logging
import random
import uuid
from dataclasses import dataclass, field

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class PexelsClip:
    """Represents a video clip from Pexels."""

    pexels_id: str
    clip_url: str
    thumbnail_url: str
    duration_seconds: float
    width: int
    height: int
    keyword: str  # Which keyword matched this clip


class PexelsService:
    """Handles stock video search and filtering via Pexels API."""

    PEXELS_VIDEO_SEARCH_URL = "https://api.pexels.com/videos/search"

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.PEXELS_API_KEY
        self._client: httpx.AsyncClient | None = None

        if self._api_key:
            self._client = httpx.AsyncClient(
                headers={"Authorization": self._api_key},
                timeout=30.0,
            )
            logger.info("Pexels API client initialized (key configured)")
        else:
            logger.info("PEXELS_API_KEY not set; using mock mode for Pexels service")

    @property
    def is_configured(self) -> bool:
        """Return True if Pexels API is available."""
        return self._client is not None

    async def search_clips(
        self,
        keywords: list[str],
        clips_per_keyword: int = 8,
        max_total: int = 40,
    ) -> list[PexelsClip]:
        """Search Pexels for vertical video clips matching keywords.

        Searches each keyword separately and merges results.

        Args:
            keywords: List of search terms (from vibe keyword extraction).
            clips_per_keyword: Number of clips to fetch per keyword.
            max_total: Maximum total clips to return.

        Returns:
            List of PexelsClip objects with video metadata.
        """
        if not self.is_configured:
            return self._search_clips_mock(keywords, clips_per_keyword, max_total)

        try:
            return await self._search_clips_real(keywords, clips_per_keyword, max_total)
        except Exception as e:
            logger.warning("Pexels API search failed, falling back to mock: %s", e)
            return self._search_clips_mock(keywords, clips_per_keyword, max_total)

    async def _search_clips_real(
        self,
        keywords: list[str],
        clips_per_keyword: int,
        max_total: int,
    ) -> list[PexelsClip]:
        """Real Pexels API search implementation."""
        all_clips: list[PexelsClip] = []
        seen_ids: set[str] = set()

        for keyword in keywords:
            if len(all_clips) >= max_total:
                break

            try:
                response = await self._client.get(
                    self.PEXELS_VIDEO_SEARCH_URL,
                    params={
                        "query": keyword,
                        "per_page": clips_per_keyword * 2,  # Fetch extra for filtering
                        "orientation": "portrait",
                        "size": "medium",
                    },
                )
                response.raise_for_status()
                data = response.json()

                videos = data.get("videos", [])
                logger.info(
                    "Pexels search '%s': %d results",
                    keyword, len(videos),
                )

                for video in videos:
                    if len(all_clips) >= max_total:
                        break

                    pexels_id = str(video.get("id", ""))
                    if pexels_id in seen_ids:
                        continue

                    duration = video.get("duration", 0)
                    if duration < 10:
                        continue  # Skip short clips

                    # Find the best video file (HD quality, portrait)
                    clip_url, width, height = self._pick_best_file(video)
                    if not clip_url:
                        continue

                    # Get thumbnail
                    thumbnail_url = video.get("image", "")

                    seen_ids.add(pexels_id)
                    all_clips.append(
                        PexelsClip(
                            pexels_id=pexels_id,
                            clip_url=clip_url,
                            thumbnail_url=thumbnail_url,
                            duration_seconds=float(duration),
                            width=width,
                            height=height,
                            keyword=keyword,
                        )
                    )

            except Exception as e:
                logger.warning("Pexels search failed for keyword '%s': %s", keyword, e)
                continue

        logger.info("Pexels search complete: %d total clips", len(all_clips))
        return all_clips[:max_total]

    def _pick_best_file(self, video: dict) -> tuple[str, int, int]:
        """Pick the best video file from a Pexels video object.

        Prefers HD quality portrait-oriented files.

        Returns:
            Tuple of (url, width, height) or ("", 0, 0) if no suitable file.
        """
        video_files = video.get("video_files", [])
        if not video_files:
            return ("", 0, 0)

        # Sort by quality: prefer HD (height >= 1080), then portrait (height > width)
        best = None
        best_score = -1

        for vf in video_files:
            w = vf.get("width", 0)
            h = vf.get("height", 0)
            quality = vf.get("quality", "")

            score = 0

            # Prefer portrait orientation
            if h > w:
                score += 100

            # Prefer HD quality
            if quality == "hd" or h >= 1080:
                score += 50
            elif quality == "sd" or h >= 720:
                score += 25

            # Prefer higher resolution
            score += min(h, 2160) / 100

            if score > best_score:
                best_score = score
                best = vf

        if best:
            return (
                best.get("link", ""),
                best.get("width", 0),
                best.get("height", 0),
            )

        return ("", 0, 0)

    def _search_clips_mock(
        self,
        keywords: list[str],
        clips_per_keyword: int,
        max_total: int,
    ) -> list[PexelsClip]:
        """Generate mock clip data for development/testing.

        Creates realistic-looking clip metadata with Pexels-style URLs.
        """
        logger.info("Generating mock Pexels clips for keywords: %s", keywords)

        # Mock video pools by theme
        mock_pools: dict[str, list[dict]] = {
            "default": [
                {"title": "Cinematic Cityscape Night", "dur": 15.0},
                {"title": "Abstract Light Bokeh", "dur": 12.0},
                {"title": "Slow Motion Waves", "dur": 18.0},
                {"title": "Aerial Mountain View", "dur": 14.0},
                {"title": "Sunset Time Lapse", "dur": 20.0},
                {"title": "Rain on Window", "dur": 16.0},
                {"title": "Neon Signs Street", "dur": 13.0},
                {"title": "Forest Path Drone", "dur": 22.0},
                {"title": "City Traffic Timelapse", "dur": 11.0},
                {"title": "Ocean Waves Beach", "dur": 25.0},
            ],
        }

        all_clips: list[PexelsClip] = []
        seen_ids: set[str] = set()

        for keyword in keywords:
            if len(all_clips) >= max_total:
                break

            pool = mock_pools.get("default", mock_pools["default"])
            # Shuffle for variety
            shuffled = random.sample(pool, min(clips_per_keyword, len(pool)))

            for item in shuffled:
                if len(all_clips) >= max_total:
                    break

                pexels_id = str(random.randint(1000000, 9999999))
                while pexels_id in seen_ids:
                    pexels_id = str(random.randint(1000000, 9999999))
                seen_ids.add(pexels_id)

                # Randomize duration slightly
                dur = item["dur"] + random.uniform(-2.0, 5.0)
                dur = max(10.0, dur)

                # Mock Pexels-style URLs
                clip_url = (
                    f"https://videos.pexels.com/video-files/"
                    f"{pexels_id}/pexels-{pexels_id}-uhd-1080x1920.mp4"
                )
                thumbnail_url = (
                    f"https://images.pexels.com/videos/{pexels_id}/"
                    f"pexels-photo-{pexels_id}.jpeg"
                )

                all_clips.append(
                    PexelsClip(
                        pexels_id=pexels_id,
                        clip_url=clip_url,
                        thumbnail_url=thumbnail_url,
                        duration_seconds=round(dur, 1),
                        width=1080,
                        height=1920,
                        keyword=keyword,
                    )
                )

        logger.info("Generated %d mock Pexels clips", len(all_clips))
        return all_clips

    def search_clips_sync(
        self,
        keywords: list[str],
        clips_per_keyword: int = 8,
        max_total: int = 40,
    ) -> list[PexelsClip]:
        """Synchronous version of search_clips for use in Celery workers.

        Uses httpx sync client for real API, or returns mock data.
        """
        if not self._api_key:
            return self._search_clips_mock(keywords, clips_per_keyword, max_total)

        try:
            return self._search_clips_sync_real(keywords, clips_per_keyword, max_total)
        except Exception as e:
            logger.warning("Pexels sync search failed, falling back to mock: %s", e)
            return self._search_clips_mock(keywords, clips_per_keyword, max_total)

    def _search_clips_sync_real(
        self,
        keywords: list[str],
        clips_per_keyword: int,
        max_total: int,
    ) -> list[PexelsClip]:
        """Synchronous real Pexels API search for Celery workers."""
        all_clips: list[PexelsClip] = []
        seen_ids: set[str] = set()

        with httpx.Client(
            headers={"Authorization": self._api_key},
            timeout=30.0,
        ) as client:
            for keyword in keywords:
                if len(all_clips) >= max_total:
                    break

                try:
                    response = client.get(
                        self.PEXELS_VIDEO_SEARCH_URL,
                        params={
                            "query": keyword,
                            "per_page": clips_per_keyword * 2,
                            "orientation": "portrait",
                            "size": "medium",
                        },
                    )
                    response.raise_for_status()
                    data = response.json()

                    videos = data.get("videos", [])
                    for video in videos:
                        if len(all_clips) >= max_total:
                            break

                        pexels_id = str(video.get("id", ""))
                        if pexels_id in seen_ids:
                            continue

                        duration = video.get("duration", 0)
                        if duration < 10:
                            continue

                        clip_url, width, height = self._pick_best_file(video)
                        if not clip_url:
                            continue

                        thumbnail_url = video.get("image", "")

                        seen_ids.add(pexels_id)
                        all_clips.append(
                            PexelsClip(
                                pexels_id=pexels_id,
                                clip_url=clip_url,
                                thumbnail_url=thumbnail_url,
                                duration_seconds=float(duration),
                                width=width,
                                height=height,
                                keyword=keyword,
                            )
                        )

                except Exception as e:
                    logger.warning(
                        "Pexels sync search failed for keyword '%s': %s",
                        keyword, e,
                    )
                    continue

        return all_clips[:max_total]


# ── Singleton ────────────────────────────────────────────────────

_pexels_service: PexelsService | None = None


def get_pexels_service() -> PexelsService:
    """Get or create the singleton PexelsService instance."""
    global _pexels_service
    if _pexels_service is None:
        _pexels_service = PexelsService()
    return _pexels_service
