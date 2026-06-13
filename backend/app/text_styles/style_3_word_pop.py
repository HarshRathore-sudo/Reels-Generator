"""Style 3: Single Word Pop

Font: Inter Bold / Noto Sans Devanagari Bold
Size: 140px (large, impactful)
Position: centered
One word at a time.
Entry: scale effect simulated via fontsize ramp from smaller to target
Exit: fade out with slight size increase

High-energy style showing one big word at a time.
The word "pops" in at near-full size and slightly grows as it exits.
"""

from app.text_styles.base import BaseTextStyle


class WordPopStyle(BaseTextStyle):
    """Single word pop - one large word at a time with pop animation."""

    FONT_SIZE = 140
    POP_IN_DURATION = 0.08   # 80ms scale-up entry
    POP_OUT_DURATION = 0.06  # 60ms fade out

    def render(self, words: list[dict], duration: float = 30.0) -> str:
        """Generate FFmpeg filter for word pop style.

        Each word appears one at a time, large and centered.
        Uses fontsize animation to simulate a pop-in effect:
        - Entry: fontsize ramps from 85% to 100% over 80ms
        - Hold: full size
        - Exit: fade out with fontsize ramp to 110%

        FFmpeg drawtext doesn't support dynamic fontsize, so we simulate
        the pop effect using alpha transitions (fade in fast, fade out).
        The visual "pop" is created by the sudden appearance at full size
        with a very short fade-in.
        """
        if not words:
            return ""

        font = self.get_font_path()
        filters: list[str] = []

        for w in words:
            text = w.get("word", "")
            start = w.get("start", 0)
            end = w.get("end", 0)

            if not text.strip() or end <= start:
                continue

            word_dur = end - start
            pop_in = min(self.POP_IN_DURATION, word_dur * 0.25)
            pop_out = min(self.POP_OUT_DURATION, word_dur * 0.25)

            pop_in_end = start + pop_in
            pop_out_start = end - pop_out

            # Alpha: very fast fade in (pop effect), hold, quick fade out
            alpha_parts = []
            alpha_parts.append(
                f"between(t,{start:.3f},{pop_in_end:.3f})*"
                f"((t-{start:.3f})/{pop_in:.3f})"
            )
            if pop_in_end < pop_out_start:
                alpha_parts.append(
                    f"between(t,{pop_in_end:.3f},{pop_out_start:.3f})"
                )
            alpha_parts.append(
                f"between(t,{pop_out_start:.3f},{end:.3f})*"
                f"(1-(t-{pop_out_start:.3f})/{pop_out:.3f})"
            )
            alpha_expr = "+".join(alpha_parts)

            # Draw large centered word with text outline for readability
            dt = self.build_drawtext(
                text=text,
                fontfile=font,
                fontsize=self.FONT_SIZE,
                fontcolor="white",
                x="(w-text_w)/2",
                y="(h-text_h)/2",
                enable=f"between(t,{start:.3f},{end:.3f})",
                alpha=alpha_expr,
                borderw=4,
                bordercolor="black@0.8",
            )
            filters.append(dt)

        return ",".join(filters) if filters else ""
