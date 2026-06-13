"""Base class for all text style renderers.

Each style takes word timestamps and produces an FFmpeg filter complex string
that can be applied during the video rendering pipeline (Phase 11).

The filter string uses drawtext filters with enable='between(t,start,end)'
expressions for timing, and alpha expressions for fade animations.

Font paths are resolved relative to the /app/fonts directory inside Docker.
"""

import os
import re
from abc import ABC, abstractmethod


class BaseTextStyle(ABC):
    """Base class for text style rendering.

    Each style takes word timestamps and produces an FFmpeg filter complex
    string using drawtext filters for text overlay.
    """

    WIDTH = 1080
    HEIGHT = 1920
    FPS = 30

    # Default font directory inside Docker container
    FONT_DIR = "/app/fonts"

    def __init__(self, language: str = "en") -> None:
        self.language = language

    @abstractmethod
    def render(self, words: list[dict], duration: float = 30.0) -> str:
        """Render text overlay as FFmpeg filter complex string.

        Args:
            words: List of {word, start, end, line_index} dicts
            duration: Total duration in seconds

        Returns:
            FFmpeg filter complex string (chain of drawtext filters)
        """
        raise NotImplementedError

    def get_font_path(self) -> str:
        """Return the appropriate bold font path based on language."""
        if self.language == "hi_dev":
            return os.path.join(self.FONT_DIR, "NotoSansDevanagari-Bold.ttf")
        return os.path.join(self.FONT_DIR, "Inter-Bold.ttf")

    def get_regular_font_path(self) -> str:
        """Return the appropriate regular font path based on language."""
        if self.language == "hi_dev":
            return os.path.join(self.FONT_DIR, "NotoSansDevanagari-Regular.ttf")
        return os.path.join(self.FONT_DIR, "Inter-Regular.ttf")

    @staticmethod
    def escape_text(text: str) -> str:
        """Escape text for FFmpeg drawtext filter.

        FFmpeg drawtext requires special escaping:
        - Single quotes -> escaped
        - Colons, backslashes, semicolons need escaping
        - Percent signs need doubling
        """
        # First escape backslashes
        text = text.replace("\\", "\\\\")
        # Escape single quotes (FFmpeg uses '' to escape ')
        text = text.replace("'", "'\\''")
        # Escape colons (used as separator in FFmpeg)
        text = text.replace(":", "\\:")
        # Escape semicolons
        text = text.replace(";", "\\;")
        # Escape percent signs
        text = text.replace("%", "%%")
        # Remove any control characters
        text = re.sub(r'[\x00-\x1f\x7f]', '', text)
        return text

    @staticmethod
    def group_words_by_line(words: list[dict]) -> dict[int, list[dict]]:
        """Group words by their line_index.

        Returns dict mapping line_index -> list of word dicts,
        sorted by line_index with words sorted by start time within each line.
        """
        lines: dict[int, list[dict]] = {}
        for w in words:
            idx = w.get("line_index", 0)
            if idx not in lines:
                lines[idx] = []
            lines[idx].append(w)

        # Sort words within each line by start time
        for idx in lines:
            lines[idx].sort(key=lambda w: w.get("start", 0))

        return dict(sorted(lines.items()))

    @staticmethod
    def get_line_text(line_words: list[dict]) -> str:
        """Get the full text for a line by joining words."""
        return " ".join(w.get("word", "") for w in line_words)

    @staticmethod
    def get_line_timing(line_words: list[dict]) -> tuple[float, float]:
        """Get the start and end time for a line."""
        starts = [w.get("start", 0) for w in line_words]
        ends = [w.get("end", 0) for w in line_words]
        return min(starts) if starts else 0, max(ends) if ends else 0

    def build_drawtext(
        self,
        text: str,
        fontfile: str,
        fontsize: int,
        fontcolor: str,
        x: str,
        y: str,
        enable: str,
        alpha: str = "1",
        shadowcolor: str | None = None,
        shadowx: int = 0,
        shadowy: int = 0,
        borderw: int = 0,
        bordercolor: str = "",
        box: bool = False,
        boxcolor: str = "",
        boxborderw: int = 0,
        extra: str = "",
    ) -> str:
        """Build a single drawtext filter string.

        Args:
            text: The text to display (will be escaped)
            fontfile: Path to font file
            fontsize: Font size in pixels
            fontcolor: Font color (FFmpeg color string)
            x: X position expression
            y: Y position expression
            enable: Enable expression (e.g., "between(t,1.0,3.0)")
            alpha: Alpha expression (for fades)
            shadowcolor: Shadow color
            shadowx: Shadow X offset
            shadowy: Shadow Y offset
            borderw: Text border width
            bordercolor: Text border color
            box: Whether to draw a background box
            boxcolor: Background box color
            boxborderw: Box border/padding width
            extra: Additional drawtext parameters

        Returns:
            FFmpeg drawtext filter string
        """
        escaped = self.escape_text(text)
        parts = [
            f"drawtext=text='{escaped}'",
            f"fontfile='{fontfile}'",
            f"fontsize={fontsize}",
            f"fontcolor={fontcolor}",
            f"x={x}",
            f"y={y}",
            f"enable='{enable}'",
        ]

        if alpha != "1":
            parts.append(f"alpha='{alpha}'")

        if shadowcolor:
            parts.append(f"shadowcolor={shadowcolor}")
            parts.append(f"shadowx={shadowx}")
            parts.append(f"shadowy={shadowy}")

        if borderw > 0:
            parts.append(f"borderw={borderw}")
            parts.append(f"bordercolor={bordercolor}")

        if box:
            parts.append("box=1")
            parts.append(f"boxcolor={boxcolor}")
            parts.append(f"boxborderw={boxborderw}")

        if extra:
            parts.append(extra)

        return ":".join(parts)
