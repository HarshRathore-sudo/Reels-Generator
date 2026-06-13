"""Style 1: Minimal Fade

Font: Inter Bold / Noto Sans Devanagari Bold
Size: 80px
Color: white
Position: centered (50%, 50%)
Animation: word fades in 150ms at start, holds, fades out 100ms before next word
Text shadow: 4px black offset, 60% opacity

One word at a time, centered on screen. Clean, minimal aesthetic.
The word fades in quickly, holds for its duration, then fades out.
"""

from app.text_styles.base import BaseTextStyle


class MinimalFadeStyle(BaseTextStyle):
    """Minimal fade - one word at a time, centered, with fade transitions."""

    FONT_SIZE = 80
    FADE_IN_MS = 150   # 0.15 seconds
    FADE_OUT_MS = 100   # 0.10 seconds

    def render(self, words: list[dict], duration: float = 30.0) -> str:
        """Generate FFmpeg filter for minimal fade style.

        Each word appears centered with a fade in at start and fade out
        before the next word begins.
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
            fade_in = min(self.FADE_IN_MS / 1000.0, word_dur * 0.3)
            fade_out = min(self.FADE_OUT_MS / 1000.0, word_dur * 0.3)

            # Alpha expression: fade in, hold, fade out
            # between(t,start,start+fade_in) -> linear 0->1
            # between(t,start+fade_in,end-fade_out) -> 1
            # between(t,end-fade_out,end) -> linear 1->0
            alpha_parts = []
            fade_in_end = start + fade_in
            fade_out_start = end - fade_out

            # Fade in: (t-start)/fade_in
            alpha_parts.append(
                f"between(t,{start:.3f},{fade_in_end:.3f})*"
                f"((t-{start:.3f})/{fade_in:.3f})"
            )
            # Hold at full opacity
            if fade_in_end < fade_out_start:
                alpha_parts.append(
                    f"between(t,{fade_in_end:.3f},{fade_out_start:.3f})"
                )
            # Fade out: 1-(t-fade_out_start)/fade_out
            alpha_parts.append(
                f"between(t,{fade_out_start:.3f},{end:.3f})*"
                f"(1-(t-{fade_out_start:.3f})/{fade_out:.3f})"
            )

            alpha_expr = "+".join(alpha_parts)

            dt = self.build_drawtext(
                text=text,
                fontfile=font,
                fontsize=self.FONT_SIZE,
                fontcolor="white",
                x="(w-text_w)/2",
                y="(h-text_h)/2",
                enable=f"between(t,{start:.3f},{end:.3f})",
                alpha=alpha_expr,
                shadowcolor="black@0.6",
                shadowx=4,
                shadowy=4,
            )
            filters.append(dt)

        return ",".join(filters) if filters else ""
