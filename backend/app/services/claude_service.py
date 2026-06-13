"""Anthropic Claude API service for vibe suggestion and keyword extraction.

Uses Claude to:
1. Suggest a vibe description based on lyrics + audio metadata (tempo, beats)
2. Extract visual search keywords from a vibe description

Supports mock mode when ANTHROPIC_API_KEY is not configured.
"""

import json
import logging
import random

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class ClaudeService:
    """Handles AI reasoning tasks via Claude API."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.ANTHROPIC_API_KEY
        self._client = None

        if self._api_key:
            try:
                import anthropic
                self._client = anthropic.AsyncAnthropic(api_key=self._api_key)
                logger.info("Claude API client initialized (key configured)")
            except ImportError:
                logger.warning("anthropic package not installed; using mock mode")
        else:
            logger.info("ANTHROPIC_API_KEY not set; using mock mode for Claude service")

    @property
    def is_configured(self) -> bool:
        """Return True if Claude API is available."""
        return self._client is not None

    async def suggest_vibe(
        self,
        tempo_bpm: float,
        lyrics_text: str,
        language: str = "hi_dev",
    ) -> str:
        """Suggest a vibe description based on audio metadata and lyrics.

        Args:
            tempo_bpm: Estimated tempo in BPM from beat detection.
            lyrics_text: Raw lyrics text (transcription).
            language: Language code (hi_dev, hi_rom, en).

        Returns:
            A short vibe description string (2-4 phrases).
        """
        if not self.is_configured:
            return self._suggest_vibe_mock(tempo_bpm, lyrics_text, language)

        try:
            return await self._suggest_vibe_real(tempo_bpm, lyrics_text, language)
        except Exception as e:
            logger.warning("Claude API suggest_vibe failed, falling back to mock: %s", e)
            return self._suggest_vibe_mock(tempo_bpm, lyrics_text, language)

    async def extract_keywords(self, vibe_description: str) -> list[str]:
        """Extract 5 visual search terms from a vibe description.

        These keywords will be used to search for stock video clips on Pexels.

        Args:
            vibe_description: The vibe description text.

        Returns:
            A list of 5 visual search keywords.
        """
        if not self.is_configured:
            return self._extract_keywords_mock(vibe_description)

        try:
            return await self._extract_keywords_real(vibe_description)
        except Exception as e:
            logger.warning("Claude API extract_keywords failed, falling back to mock: %s", e)
            return self._extract_keywords_mock(vibe_description)

    async def rank_clips(self, vibe_description: str, clips: list[dict]) -> list[str]:
        """Rank clips by relevance to the vibe. Returns ordered clip IDs.

        Args:
            vibe_description: The vibe description text.
            clips: List of clip dicts with 'pexels_id', 'keyword', 'duration_seconds'.

        Returns:
            Ordered list of pexels_id strings, most relevant first.
        """
        if not clips:
            return []

        if not self.is_configured:
            return self._rank_clips_mock(vibe_description, clips)

        try:
            return await self._rank_clips_real(vibe_description, clips)
        except Exception as e:
            logger.warning("Claude API rank_clips failed, falling back to mock: %s", e)
            return self._rank_clips_mock(vibe_description, clips)

    async def _rank_clips_real(self, vibe_description: str, clips: list[dict]) -> list[str]:
        """Use Claude to rank clips by visual relevance to the vibe."""
        # Build a compact clip list for the prompt
        clip_summaries = []
        for c in clips[:30]:  # Limit to 30 clips for prompt size
            clip_summaries.append(
                f"- ID: {c['pexels_id']}, keyword: \"{c.get('keyword', 'unknown')}\", "
                f"duration: {c.get('duration_seconds', 0):.0f}s"
            )

        clips_text = "\n".join(clip_summaries)

        prompt = f"""You are a visual curator for Instagram music reels. Given a vibe description and a list of stock video clips, rank the clips by how well they visually match the vibe.

Vibe description: "{vibe_description}"

Available clips:
{clips_text}

Rank ALL clips from most to least relevant. Consider:
- How well the keyword matches the vibe's mood and setting
- Prefer longer clips (more editing flexibility)
- Prefer diverse visual content (don't group all similar clips together)

Respond with ONLY a JSON array of clip IDs in ranked order, most relevant first.
Example: ["1234567", "2345678", "3456789"]"""

        message = await self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text.strip()

        try:
            ranked_ids = json.loads(response_text)
            if isinstance(ranked_ids, list) and all(isinstance(x, (str, int)) for x in ranked_ids):
                result = [str(x) for x in ranked_ids]
                logger.info("Claude ranked %d clips", len(result))
                return result
        except json.JSONDecodeError:
            pass

        # Fallback to mock if parsing fails
        logger.warning("Could not parse Claude rank_clips response, using mock")
        return self._rank_clips_mock(vibe_description, clips)

    def _rank_clips_mock(self, vibe_description: str, clips: list[dict]) -> list[str]:
        """Mock ranking: score clips by keyword relevance to vibe description.

        Simple heuristic: clips whose keyword appears in the vibe get higher scores.
        Longer clips also get a slight boost.
        """
        vibe_lower = vibe_description.lower()
        scored: list[tuple[float, str]] = []

        for clip in clips:
            pexels_id = clip.get("pexels_id", "")
            keyword = clip.get("keyword", "").lower()
            duration = clip.get("duration_seconds", 10.0)

            score = 0.0

            # Keyword relevance: check if keyword words appear in vibe
            keyword_words = keyword.split()
            for word in keyword_words:
                if word in vibe_lower:
                    score += 30.0

            # Duration bonus: prefer longer clips (more flexibility)
            score += min(duration, 30.0)

            # Add slight randomness for variety
            score += random.uniform(0, 10.0)

            scored.append((score, pexels_id))

        # Sort by score descending
        scored.sort(key=lambda x: x[0], reverse=True)
        return [pid for _, pid in scored]

    # ── Real Claude API implementations ──────────────────────────────

    async def _suggest_vibe_real(
        self,
        tempo_bpm: float,
        lyrics_text: str,
        language: str,
    ) -> str:
        """Use Claude API to generate a vibe suggestion."""
        lang_label = {
            "hi_dev": "Hindi (Devanagari)",
            "hi_rom": "Hindi (Romanized)",
            "en": "English",
        }.get(language, "Unknown")

        # Truncate lyrics if too long (keep first ~500 chars)
        lyrics_sample = lyrics_text[:500] if len(lyrics_text) > 500 else lyrics_text

        prompt = f"""You are a creative director for Instagram music reels. Based on the following song details, suggest a short vibe description (2-4 comma-separated phrases) that captures the mood and aesthetic for a visual reel.

Song details:
- Tempo: {tempo_bpm:.0f} BPM
- Language: {lang_label}
- Lyrics excerpt:
{lyrics_sample}

Guidelines:
- Keep it to 2-4 short phrases separated by commas
- Focus on visual mood, setting, color palette, and emotion
- Think about what backgrounds/scenes would match this song
- Examples: "late night drive, neon city lights, melancholic", "sunny rooftop party, warm golden hour, joyful energy", "rainy window, cozy cafe vibes, nostalgic longing"

Respond with ONLY the vibe description phrases, nothing else."""

        message = await self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )

        vibe_text = message.content[0].text.strip()
        # Clean up any quotes
        vibe_text = vibe_text.strip('"').strip("'")
        logger.info("Claude suggested vibe: %s", vibe_text)
        return vibe_text

    async def _extract_keywords_real(self, vibe_description: str) -> list[str]:
        """Use Claude API to extract visual search keywords."""
        prompt = f"""You are a visual content curator. Given a vibe description for an Instagram music reel, extract exactly 5 search keywords that would find the best matching stock video clips on Pexels.

Vibe description: "{vibe_description}"

Guidelines:
- Each keyword should be 1-3 words
- Focus on concrete visual elements (settings, objects, nature, activities)
- Avoid abstract concepts - think about what a camera would actually film
- Make keywords diverse to get varied clip results
- Good examples: "city skyline night", "ocean waves sunset", "neon lights", "rain window", "dancing crowd"

Respond with a JSON array of exactly 5 strings. Example: ["city night", "neon signs", "rainy street", "car lights", "urban skyline"]"""

        message = await self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text.strip()

        # Parse JSON array from response
        try:
            keywords = json.loads(response_text)
            if isinstance(keywords, list) and all(isinstance(k, str) for k in keywords):
                keywords = [k.strip() for k in keywords[:10] if k.strip()]
                if len(keywords) >= 3:
                    logger.info("Claude extracted keywords: %s", keywords)
                    return keywords[:5]
        except json.JSONDecodeError:
            pass

        # Fallback: try to extract from comma-separated text
        parts = [p.strip().strip('"').strip("'") for p in response_text.split(",")]
        keywords = [p for p in parts if p and len(p) < 50]
        if len(keywords) >= 3:
            logger.info("Claude extracted keywords (comma-parsed): %s", keywords[:5])
            return keywords[:5]

        # Last resort: use mock
        logger.warning("Could not parse Claude keywords response, using mock")
        return self._extract_keywords_mock(vibe_description)

    # ── Mock implementations ─────────────────────────────────────────

    def _suggest_vibe_mock(
        self,
        tempo_bpm: float,
        lyrics_text: str,
        language: str,
    ) -> str:
        """Generate a mock vibe suggestion based on tempo."""
        # Determine energy from BPM
        if tempo_bpm < 100:
            energy = "slow"
        elif tempo_bpm < 120:
            energy = "medium"
        else:
            energy = "high"

        slow_vibes = [
            "late night drive, soft city lights, melancholic longing",
            "rainy window, cozy blankets, nostalgic memories",
            "moonlit rooftop, gentle breeze, quiet heartbreak",
            "empty streets at dawn, fading lights, bittersweet farewell",
            "candlelit room, old photographs, tender romance",
        ]

        medium_vibes = [
            "golden hour rooftop, warm sunset glow, carefree romance",
            "autumn leaves falling, coffee shop windows, wistful beauty",
            "ocean drive, pastel skies, dreamy wanderlust",
            "fairy lights garden, soft laughter, intimate celebration",
            "vintage film grain, sunlit meadow, peaceful contentment",
        ]

        high_vibes = [
            "neon club lights, electric energy, unstoppable confidence",
            "rooftop party, city skyline, euphoric celebration",
            "festival crowd, colorful smoke, wild freedom",
            "fast cars, night highway, adrenaline rush",
            "beach bonfire, dancing silhouettes, summer ecstasy",
        ]

        vibes = {
            "slow": slow_vibes,
            "medium": medium_vibes,
            "high": high_vibes,
        }

        return random.choice(vibes[energy])

    def _extract_keywords_mock(self, vibe_description: str) -> list[str]:
        """Generate mock keywords from vibe description.

        Analyzes the vibe text and generates relevant visual search terms.
        """
        vibe_lower = vibe_description.lower()

        # Keyword pools mapped to common vibe themes
        keyword_pools: dict[str, list[str]] = {
            "night": ["city night", "neon lights", "street lights", "dark sky", "night drive"],
            "rain": ["rain drops", "rainy street", "rain window", "wet road", "umbrella"],
            "sunset": ["golden sunset", "ocean horizon", "warm sky", "silhouette", "golden hour"],
            "party": ["dancing crowd", "confetti", "disco lights", "celebration", "concert"],
            "nature": ["green forest", "mountain peak", "flowing river", "wildflowers", "sunrise"],
            "ocean": ["ocean waves", "beach sand", "sea shore", "underwater", "sailing boat"],
            "city": ["city skyline", "urban street", "traffic lights", "skyscraper", "busy road"],
            "romantic": ["couple walking", "roses", "candlelight", "holding hands", "love letter"],
            "melancholic": ["empty road", "foggy morning", "lone figure", "autumn leaves", "fading light"],
            "energetic": ["fast motion", "sports action", "running", "jumping", "speed blur"],
        }

        # Find matching themes
        matched_keywords: list[str] = []
        for theme, keywords in keyword_pools.items():
            if theme in vibe_lower:
                matched_keywords.extend(keywords)

        # If we found matches, pick 5 from them
        if len(matched_keywords) >= 5:
            return random.sample(matched_keywords, 5)

        # Fallback: general aesthetic keywords
        general = [
            "cinematic landscape", "bokeh lights", "slow motion",
            "aerial view", "time lapse", "abstract light",
            "smoke effect", "lens flare", "dreamy atmosphere",
            "vintage film", "motion blur", "color gradient",
            "reflection water", "floating particles", "soft focus",
        ]

        # Mix matched + general
        pool = matched_keywords + general
        return random.sample(pool, min(5, len(pool)))


# ── Singleton ────────────────────────────────────────────────────

_claude_service: ClaudeService | None = None


def get_claude_service() -> ClaudeService:
    """Get or create the singleton ClaudeService instance."""
    global _claude_service
    if _claude_service is None:
        _claude_service = ClaudeService()
    return _claude_service
