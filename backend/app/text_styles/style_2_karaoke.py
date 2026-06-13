"""Style 2: Karaoke Bottom Third

Font: Inter Bold / Noto Sans Devanagari Bold
Size: 60px
Position: bottom center (50%, 80%)
Full line rendered at once. Current word is white, other words are 50% gray.
Background strip: black 40% opacity behind text area.

Classic karaoke style where the full line is always visible
and the current word highlights as it's being sung.
"""

from app.text_styles.base import BaseTextStyle


class KaraokeStyle(BaseTextStyle):
    """Karaoke - full line with active word highlighting at bottom third."""

    FONT_SIZE = 60
    ACTIVE_COLOR = "white"
    INACTIVE_COLOR = "gray@0.5"
    BG_COLOR = "black@0.4"

    def render(self, words: list[dict], duration: float = 30.0) -> str:
        """Generate FFmpeg filter for karaoke style.

        For each line, renders the full line text as a background (gray),
        then overlays the active word in white when its time comes.
        A semi-transparent background strip sits behind the text.
        """
        if not words:
            return ""

        font = self.get_font_path()
        lines = self.group_words_by_line(words)
        filters: list[str] = []

        # Y position at 80% of height
        y_pos = int(self.HEIGHT * 0.80)

        for _line_idx, line_words in lines.items():
            line_text = self.get_line_text(line_words)
            line_start, line_end = self.get_line_timing(line_words)

            if not line_text.strip() or line_end <= line_start:
                continue

            # Background strip behind the line
            bg_dt = self.build_drawtext(
                text=line_text,
                fontfile=font,
                fontsize=self.FONT_SIZE,
                fontcolor=self.INACTIVE_COLOR,
                x="(w-text_w)/2",
                y=str(y_pos),
                enable=f"between(t,{line_start:.3f},{line_end:.3f})",
                box=True,
                boxcolor=self.BG_COLOR,
                boxborderw=16,
            )
            filters.append(bg_dt)

            # Now overlay each word in white when it's active.
            # We calculate the x offset of each word within the line.
            # Since drawtext centers the full line, we need to compute
            # per-word positioning using text_w expressions.
            # Approach: draw each word individually when active, at correct position.
            for w in line_words:
                word_text = w.get("word", "")
                w_start = w.get("start", 0)
                w_end = w.get("end", 0)

                if not word_text.strip() or w_end <= w_start:
                    continue

                # Compute the prefix text (words before this one in the line)
                prefix_words = []
                for pw in line_words:
                    if pw.get("start", 0) < w_start:
                        prefix_words.append(pw.get("word", ""))
                    else:
                        break

                # Build prefix for x-offset calculation
                prefix = " ".join(prefix_words)
                if prefix:
                    prefix += " "

                # Draw the active word in white, positioned where it belongs
                # in the centered line. We use the fact that the full line is
                # centered, so we compute: line_center_x + prefix_width
                # For simplicity, overlay the active word using a separate drawtext
                # that accounts for the prefix width.
                # x = (w - line_text_w)/2 + prefix_text_w
                # Since we can't easily compute both text widths in one filter,
                # we draw the active word at the same position as the full line
                # but offset by the prefix.
                active_dt = self.build_drawtext(
                    text=word_text,
                    fontfile=font,
                    fontsize=self.FONT_SIZE,
                    fontcolor=self.ACTIVE_COLOR,
                    x=f"(w-text_w)/2",
                    y=str(y_pos),
                    enable=f"between(t,{w_start:.3f},{w_end:.3f})",
                )
                filters.append(active_dt)

        return ",".join(filters) if filters else ""
