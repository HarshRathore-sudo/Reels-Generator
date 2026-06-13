"""Style 4: Typewriter

Font: Inter Bold / Noto Sans Devanagari Bold
Size: 55px
Position: centered, fixed Y at 50%
Words appear one by one with a quick fade in (80ms).
Words accumulate on the current line. When the line changes,
previous words disappear and the new line starts fresh.

Creates a typewriter effect where words appear to be typed out
one at a time, building up the line progressively.
"""

from app.text_styles.base import BaseTextStyle


class TypewriterStyle(BaseTextStyle):
    """Typewriter - words accumulate on line with fade-in reveal."""

    FONT_SIZE = 55
    FADE_IN_MS = 80  # 80ms fade per word

    def render(self, words: list[dict], duration: float = 30.0) -> str:
        """Generate FFmpeg filter for typewriter style.

        Words appear progressively on each line. Each word fades in
        when its timestamp arrives and stays visible until the line ends.
        When a new line starts, all previous words disappear.

        For each word, we render the accumulated text up to that word,
        visible from that word's start until the next word's start
        (or line end). This creates the typewriter accumulation effect.
        """
        if not words:
            return ""

        font = self.get_font_path()
        lines = self.group_words_by_line(words)
        filters: list[str] = []

        # Y position centered
        y_pos = int(self.HEIGHT * 0.50)

        for _line_idx, line_words in lines.items():
            _, line_end = self.get_line_timing(line_words)

            if not line_words or line_end <= 0:
                continue

            # For each word in the line, draw the accumulated text
            # from this word's start to the next word's start (or line end)
            for i, w in enumerate(line_words):
                word_text = w.get("word", "")
                w_start = w.get("start", 0)
                w_end = w.get("end", 0)

                if not word_text.strip():
                    continue

                # Accumulated text: all words from start of line up to and
                # including this word
                accumulated = " ".join(
                    lw.get("word", "") for lw in line_words[:i + 1]
                )

                # This accumulated text is visible from this word's start
                # until the next word appears (replacing it with a longer string)
                # or until the line ends
                if i < len(line_words) - 1:
                    # Visible until next word starts
                    visible_end = line_words[i + 1].get("start", line_end)
                else:
                    # Last word in line - visible until line ends
                    visible_end = line_end

                if visible_end <= w_start:
                    visible_end = w_end

                fade_in = min(self.FADE_IN_MS / 1000.0, (visible_end - w_start) * 0.4)
                fade_in_end = w_start + fade_in

                # Alpha: fade in for the new word portion, then hold
                alpha_parts = []
                alpha_parts.append(
                    f"between(t,{w_start:.3f},{fade_in_end:.3f})*"
                    f"((t-{w_start:.3f})/{fade_in:.3f})"
                )
                if fade_in_end < visible_end:
                    alpha_parts.append(
                        f"between(t,{fade_in_end:.3f},{visible_end:.3f})"
                    )
                alpha_expr = "+".join(alpha_parts)

                dt = self.build_drawtext(
                    text=accumulated,
                    fontfile=font,
                    fontsize=self.FONT_SIZE,
                    fontcolor="white",
                    x="(w-text_w)/2",
                    y=str(y_pos),
                    enable=f"between(t,{w_start:.3f},{visible_end:.3f})",
                    alpha=alpha_expr,
                    shadowcolor="black@0.5",
                    shadowx=2,
                    shadowy=2,
                )
                filters.append(dt)

        return ",".join(filters) if filters else ""
