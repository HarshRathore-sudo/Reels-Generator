"""Style 5: Stacked Lines

Font: Inter Bold / Noto Sans Devanagari Bold
Current line: 70px, full opacity, centered
Previous line: 45px, 50% opacity
Line before that: 30px, 25% opacity

Lines are stacked vertically in the center of the screen.
As new lines appear, older lines shrink and fade.
Creates a flowing, layered lyrical display.
"""

from app.text_styles.base import BaseTextStyle


class StackedLinesStyle(BaseTextStyle):
    """Stacked lines - current large, previous smaller and faded."""

    # Font sizes for each position relative to current
    CURRENT_SIZE = 70
    PREV_SIZE = 45
    OLDER_SIZE = 30

    # Alpha values
    CURRENT_ALPHA = "1"
    PREV_ALPHA = "0.5"
    OLDER_ALPHA = "0.25"

    # Vertical spacing
    LINE_GAP = 20  # pixels between lines

    def render(self, words: list[dict], duration: float = 30.0) -> str:
        """Generate FFmpeg filter for stacked lines style.

        Shows up to 3 lines at once:
        - Current active line: large, full opacity
        - Previous line: medium, half opacity
        - Older line: small, quarter opacity

        Lines are vertically centered as a group.
        """
        if not words:
            return ""

        font = self.get_font_path()
        lines = self.group_words_by_line(words)
        line_indices = sorted(lines.keys())
        filters: list[str] = []

        for pos, line_idx in enumerate(line_indices):
            line_words = lines[line_idx]
            line_text = self.get_line_text(line_words)
            line_start, line_end = self.get_line_timing(line_words)

            if not line_text.strip() or line_end <= line_start:
                continue

            # Determine when the next line starts (if any)
            next_line_start = duration
            if pos < len(line_indices) - 1:
                next_words = lines[line_indices[pos + 1]]
                next_start, _ = self.get_line_timing(next_words)
                next_line_start = next_start

            # This line is CURRENT during its own time window
            # center_y for the current line
            center_y = int(self.HEIGHT * 0.50)

            # Current line: visible from line_start to next_line_start
            current_visible_end = min(next_line_start, duration)
            if current_visible_end > line_start:
                dt = self.build_drawtext(
                    text=line_text,
                    fontfile=font,
                    fontsize=self.CURRENT_SIZE,
                    fontcolor="white",
                    x="(w-text_w)/2",
                    y=str(center_y),
                    enable=f"between(t,{line_start:.3f},{current_visible_end:.3f})",
                    alpha=self.CURRENT_ALPHA,
                    shadowcolor="black@0.4",
                    shadowx=2,
                    shadowy=2,
                )
                filters.append(dt)

            # This line as PREVIOUS (when the next line is current)
            if pos < len(line_indices) - 1:
                prev_visible_start = next_line_start
                # Visible as previous until 2 lines later starts, or duration
                prev_visible_end = duration
                if pos + 2 < len(line_indices):
                    two_ahead_words = lines[line_indices[pos + 2]]
                    two_ahead_start, _ = self.get_line_timing(two_ahead_words)
                    prev_visible_end = min(two_ahead_start, duration)

                # Position above current: center_y - prev_size - gap
                prev_y = center_y - self.PREV_SIZE - self.LINE_GAP

                if prev_visible_end > prev_visible_start:
                    dt = self.build_drawtext(
                        text=line_text,
                        fontfile=font,
                        fontsize=self.PREV_SIZE,
                        fontcolor="white",
                        x="(w-text_w)/2",
                        y=str(prev_y),
                        enable=f"between(t,{prev_visible_start:.3f},{prev_visible_end:.3f})",
                        alpha=self.PREV_ALPHA,
                    )
                    filters.append(dt)

            # This line as OLDER (when the line 2 positions ahead is current)
            if pos < len(line_indices) - 2:
                older_visible_start = duration
                two_ahead_words = lines[line_indices[pos + 2]]
                two_ahead_start, _ = self.get_line_timing(two_ahead_words)
                older_visible_start = two_ahead_start

                older_visible_end = duration
                if pos + 3 < len(line_indices):
                    three_ahead_words = lines[line_indices[pos + 3]]
                    three_ahead_start, _ = self.get_line_timing(three_ahead_words)
                    older_visible_end = min(three_ahead_start, duration)

                # Position above previous: center_y - prev - older - gaps
                older_y = center_y - self.PREV_SIZE - self.OLDER_SIZE - self.LINE_GAP * 2

                if older_visible_end > older_visible_start:
                    dt = self.build_drawtext(
                        text=line_text,
                        fontfile=font,
                        fontsize=self.OLDER_SIZE,
                        fontcolor="white",
                        x="(w-text_w)/2",
                        y=str(older_y),
                        enable=f"between(t,{older_visible_start:.3f},{older_visible_end:.3f})",
                        alpha=self.OLDER_ALPHA,
                    )
                    filters.append(dt)

        return ",".join(filters) if filters else ""
