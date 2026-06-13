from app.text_styles.base import BaseTextStyle
from app.text_styles.style_1_minimal_fade import MinimalFadeStyle
from app.text_styles.style_2_karaoke import KaraokeStyle
from app.text_styles.style_3_word_pop import WordPopStyle
from app.text_styles.style_4_typewriter import TypewriterStyle
from app.text_styles.style_5_stacked import StackedLinesStyle
from app.text_styles.style_6_cinematic import CinematicSubtitleStyle

STYLES: dict[int, type[BaseTextStyle]] = {
    1: MinimalFadeStyle,
    2: KaraokeStyle,
    3: WordPopStyle,
    4: TypewriterStyle,
    5: StackedLinesStyle,
    6: CinematicSubtitleStyle,
}

__all__ = [
    "BaseTextStyle",
    "MinimalFadeStyle",
    "KaraokeStyle",
    "WordPopStyle",
    "TypewriterStyle",
    "StackedLinesStyle",
    "CinematicSubtitleStyle",
    "STYLES",
]
