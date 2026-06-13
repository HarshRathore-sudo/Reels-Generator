"""Text rendering service that dispatches to individual style modules.

This service is the main entry point for generating FFmpeg filter complex
strings for text overlays. It:
1. Validates the requested style number (1-6)
2. Instantiates the appropriate style renderer with language config
3. Calls render() to get the FFmpeg filter string
4. Returns the filter string for use in the render pipeline (Phase 11)
"""

import logging
from app.text_styles import STYLES, BaseTextStyle

logger = logging.getLogger(__name__)

# Style metadata for API responses and frontend display
STYLE_INFO = {
    1: {
        "id": 1,
        "name": "Minimal Fade",
        "description": "One word at a time, centered. Fades in/out smoothly.",
        "category": "minimal",
    },
    2: {
        "id": 2,
        "name": "Karaoke",
        "description": "Full line at bottom. Active word highlights white.",
        "category": "karaoke",
    },
    3: {
        "id": 3,
        "name": "Word Pop",
        "description": "Large single word, centered. Pops in with impact.",
        "category": "bold",
    },
    4: {
        "id": 4,
        "name": "Typewriter",
        "description": "Words appear one by one, building up the line.",
        "category": "elegant",
    },
    5: {
        "id": 5,
        "name": "Stacked Lines",
        "description": "Current line large, previous lines smaller and faded.",
        "category": "layered",
    },
    6: {
        "id": 6,
        "name": "Cinematic",
        "description": "Clean subtitle at bottom. Full line, film-style.",
        "category": "cinematic",
    },
}


class TextRenderService:
    """Dispatches text rendering to the appropriate style module."""

    def __init__(self) -> None:
        self._styles = STYLES

    @property
    def available_styles(self) -> list[dict]:
        """Return list of available style info dicts."""
        return list(STYLE_INFO.values())

    def get_style_info(self, style_number: int) -> dict | None:
        """Get info for a specific style."""
        return STYLE_INFO.get(style_number)

    def validate_style(self, style_number: int) -> bool:
        """Check if style number is valid."""
        return style_number in self._styles

    def get_renderer(self, style_number: int, language: str = "en") -> BaseTextStyle:
        """Get an instantiated style renderer.

        Args:
            style_number: Style ID (1-6)
            language: Language code ("en", "hi_dev", "hi_rom")

        Returns:
            Instantiated style renderer

        Raises:
            ValueError: If style_number is invalid
        """
        style_cls = self._styles.get(style_number)
        if style_cls is None:
            raise ValueError(
                f"Invalid style number {style_number}. "
                f"Available: {list(self._styles.keys())}"
            )
        return style_cls(language=language)

    def render(self, style_number: int, words: list[dict], language: str = "en", duration: float = 30.0) -> str:
        """Render text overlay using the specified style.

        Args:
            style_number: Style ID (1-6)
            words: List of word dicts with {word, start, end, line_index}
            language: Language code for font selection
            duration: Total duration in seconds

        Returns:
            FFmpeg filter complex string (chain of drawtext filters)

        Raises:
            ValueError: If style_number is invalid
        """
        renderer = self.get_renderer(style_number, language)
        logger.info(
            "Rendering style %d (%s) with %d words, duration=%.1fs, lang=%s",
            style_number,
            type(renderer).__name__,
            len(words),
            duration,
            language,
        )
        filter_str = renderer.render(words, duration)
        logger.info(
            "Generated filter string: %d chars, %d drawtext filters",
            len(filter_str),
            filter_str.count("drawtext=") if filter_str else 0,
        )
        return filter_str


# Singleton
_text_render_service: TextRenderService | None = None


def get_text_render_service() -> TextRenderService:
    """Get or create the singleton TextRenderService."""
    global _text_render_service
    if _text_render_service is None:
        _text_render_service = TextRenderService()
    return _text_render_service
