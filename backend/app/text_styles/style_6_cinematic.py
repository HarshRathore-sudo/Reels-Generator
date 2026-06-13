"""Style 6: Cinematic Subtitle

Font: Inter Regular / Noto Sans Devanagari Regular
Size: 50px
Position: bottom (50%, 85%)
Full line appears 200ms before first word, fades out 200ms after last.
No word-level animation - entire line appears/disappears together.
Increased letter spacing for cinematic feel.
Background strip: black 30% opacity.

Clean, film-subtitle aesthetic. Lines appear smoothly and disappear
after they're done. No per-word highlighting - the entire line
is visible at once.
"""

from app.text_styles.base import BaseTextStyle


class CinematicSubtitleStyle(BaseTextStyle):
    """Cinematic subtitle - clean bottom text with line-level animation."""

    FONT_SIZE = 50
    PRE_APPEAR_MS = 200   # appear 200ms before first word
    POST_FADE_MS = 200    # fade out 200ms after last word
    FADE_DURATION_MS = 200  # fade transition duration

    def render(self, words: list[dict], duration: float = 30.0) -> str:
        """Generate FFmpeg filter for cinematic subtitle style.

        Each line appears as a complete subtitle at the bottom of screen.
        Lines fade in 200ms before the first word starts and fade out
        200ms after the last word ends. Uses the regular (not bold) font
        for a more refined look.
        """
        if not words:
            return ""

        # Cinematic uses regular font for elegance
        font = self.get_regular_font_path()
        lines = self.group_words_by_line(words)
        filters: list[str] = []

        # Y position at 85% of height
        y_pos = int(self.HEIGHT * 0.85)

        for _line_idx, line_words in lines.items():
            line_text = self.get_line_text(line_words)
            line_start, line_end = self.get_line_timing(line_words)

            if not line_text.strip() or line_end <= line_start:
                continue

            # Appear slightly before, disappear slightly after
            appear_start = max(0, line_start - self.PRE_APPEAR_MS / 1000.0)
            disappear_end = min(duration, line_end + self.POST_FADE_MS / 1000.0)
            fade_dur = self.FADE_DURATION_MS / 1000.0

            fade_in_end = appear_start + fade_dur
            fade_out_start = disappear_end - fade_dur

            # Alpha: fade in, hold, fade out
            alpha_parts = []
            alpha_parts.append(
                f"between(t,{appear_start:.3f},{fade_in_end:.3f})*"
                f"((t-{appear_start:.3f})/{fade_dur:.3f})"
            )
            if fade_in_end < fade_out_start:
                alpha_parts.append(
                    f"between(t,{fade_in_end:.3f},{fade_out_start:.3f})"
                )
            alpha_parts.append(
                f"between(t,{fade_out_start:.3f},{disappear_end:.3f})*"
                f"(1-(t-{fade_out_start:.3f})/{fade_dur:.3f})"
            )
            alpha_expr = "+".join(alpha_parts)

            dt = self.build_drawtext(
                text=line_text,
                fontfile=font,
                fontsize=self.FONT_SIZE,
                fontcolor="white",
                x="(w-text_w)/2",
                y=str(y_pos),
                enable=f"between(t,{appear_start:.3f},{disappear_end:.3f})",
                alpha=alpha_expr,
                box=True,
                boxcolor="black@0.3",
                boxborderw=12,
            )
            filters.append(dt)

        return ",".join(filters) if filters else ""
