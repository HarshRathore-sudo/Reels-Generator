"""Transcription service for word-level audio transcription.

Supports two modes:
1. Mock mode (default): Generates realistic word-level timing data
   based on audio duration and language. Used for development/testing.
2. WhisperX mode (future): Uses WhisperX with large-v3 model for
   real transcription with word-level alignment.

The mock mode generates sample lyrics in the appropriate language
(Hindi Devanagari, Hindi Roman/Hinglish, or English) with realistic
timing distribution across the audio duration.
"""

import logging
import math
import random
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Word-level result type ──────────────────────────────────────

class TranscriptionWord:
    """A single word with timing information."""
    def __init__(self, word: str, start: float, end: float, line_index: int):
        self.word = word
        self.start = start
        self.end = end
        self.line_index = line_index

    def to_dict(self) -> dict:
        return {
            "word": self.word,
            "start": round(self.start, 3),
            "end": round(self.end, 3),
            "line_index": self.line_index,
        }


class TranscriptionResult:
    """Complete transcription result."""
    def __init__(self, words: list[TranscriptionWord], raw_text: str):
        self.words = words
        self.raw_text = raw_text

    def to_dict(self) -> dict:
        return {
            "words": [w.to_dict() for w in self.words],
            "raw_transcription": self.raw_text,
        }


# ─── Sample lyrics data for mock mode ────────────────────────────

SAMPLE_LYRICS_HI_DEV = [
    ["तुम", "ही", "हो", "मेरी", "आशिकी"],
    ["तुम", "ही", "हो", "अब", "तुम", "ही", "हो"],
    ["जीना", "मेरा", "तुम", "ही", "हो"],
    ["तेरा", "मेरा", "रिश्ता", "है", "कैसा"],
    ["एक", "पल", "दूर", "गवारा", "नहीं"],
    ["तेरे", "लिए", "हर", "रोज़", "है", "जीना"],
    ["तेरे", "बिन", "मैं", "कुछ", "भी", "नहीं"],
    ["दिल", "को", "करार", "आया", "है"],
    ["सितारों", "में", "बसेरा", "है"],
]

SAMPLE_LYRICS_HI_ROM = [
    ["Tum", "hi", "ho", "meri", "aashiqui"],
    ["Tum", "hi", "ho", "ab", "tum", "hi", "ho"],
    ["Jeena", "mera", "tum", "hi", "ho"],
    ["Tera", "mera", "rishta", "hai", "kaisa"],
    ["Ek", "pal", "door", "gawara", "nahi"],
    ["Tere", "liye", "har", "roz", "hai", "jeena"],
    ["Tere", "bin", "main", "kuch", "bhi", "nahi"],
    ["Dil", "ko", "karaar", "aaya", "hai"],
    ["Sitaaron", "mein", "basera", "hai"],
]

SAMPLE_LYRICS_EN = [
    ["You", "are", "my", "everything"],
    ["Without", "you", "I", "am", "nothing"],
    ["Every", "moment", "with", "you", "feels", "right"],
    ["Hold", "me", "close", "tonight"],
    ["Dancing", "in", "the", "moonlight"],
    ["We", "belong", "together", "forever"],
    ["Take", "my", "hand", "and", "never", "let", "go"],
    ["This", "love", "is", "all", "I", "know"],
    ["Together", "we", "shine", "so", "bright"],
]


# ─── Transcription engine ────────────────────────────────────────

def transcribe_audio_mock(
    audio_duration: float,
    language: str = "hi_dev",
) -> TranscriptionResult:
    """Generate mock transcription with realistic word-level timing.

    Creates sample lyrics in the specified language with words
    distributed across the audio duration.

    Args:
        audio_duration: Duration of the audio in seconds
        language: One of 'hi_dev', 'hi_rom', 'en'

    Returns:
        TranscriptionResult with word-level timing data
    """
    # Select sample lyrics based on language
    if language == "hi_dev":
        all_lines = SAMPLE_LYRICS_HI_DEV
    elif language == "hi_rom":
        all_lines = SAMPLE_LYRICS_HI_ROM
    else:
        all_lines = SAMPLE_LYRICS_EN

    # Determine how many lines fit in the duration
    # Average: ~3.5 seconds per line with gaps
    avg_line_duration = 3.0
    gap_between_lines = 0.5
    total_line_time = avg_line_duration + gap_between_lines

    num_lines = max(2, min(len(all_lines), int(audio_duration / total_line_time)))

    # Select lines (cycle if needed)
    selected_lines: list[list[str]] = []
    for i in range(num_lines):
        selected_lines.append(all_lines[i % len(all_lines)])

    # Distribute timing across audio duration
    # Leave a small intro (0.5s) and outro (0.5s)
    usable_start = 0.5
    usable_end = audio_duration - 0.5
    usable_duration = usable_end - usable_start

    # Calculate timing for each line
    time_per_line = usable_duration / num_lines

    words: list[TranscriptionWord] = []
    current_time = usable_start

    for line_idx, line_words in enumerate(selected_lines):
        line_start = current_time
        # Each word gets roughly equal time within the line, with small variations
        word_count = len(line_words)
        word_duration = (time_per_line - gap_between_lines) / word_count
        word_gap = 0.05  # 50ms gap between words

        for w_idx, word_text in enumerate(line_words):
            # Add small random variation for realism
            variation = random.uniform(-0.05, 0.05)
            w_start = line_start + w_idx * word_duration + variation
            w_end = w_start + word_duration - word_gap

            # Clamp to valid bounds
            w_start = max(0, round(w_start, 3))
            w_end = min(audio_duration, round(w_end, 3))

            if w_end <= w_start:
                w_end = w_start + 0.1

            words.append(TranscriptionWord(
                word=word_text,
                start=w_start,
                end=w_end,
                line_index=line_idx,
            ))

        current_time += time_per_line

    # Build raw text
    raw_lines = [" ".join(line) for line in selected_lines]
    raw_text = "\n".join(raw_lines)

    logger.info(
        "Mock transcription generated: %d words in %d lines for %.1fs audio (%s)",
        len(words), num_lines, audio_duration, language,
    )

    return TranscriptionResult(words=words, raw_text=raw_text)


def transcribe_audio_file(
    audio_path: str,
    language: str = "hi_dev",
    audio_duration: Optional[float] = None,
) -> TranscriptionResult:
    """Transcribe an audio file.

    Currently uses mock transcription. When WhisperX is installed and
    GPU is available, this will use real transcription.

    Args:
        audio_path: Path to the audio file on disk
        language: Language code ('hi_dev', 'hi_rom', 'en')
        audio_duration: Optional pre-known duration (avoids re-probing)

    Returns:
        TranscriptionResult with word-level timing
    """
    # Try to get duration from FFmpeg if not provided
    if audio_duration is None:
        try:
            import subprocess
            result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries",
                 "format=duration", "-of", "csv=p=0", audio_path],
                capture_output=True, text=True, timeout=10,
            )
            audio_duration = float(result.stdout.strip())
        except Exception:
            audio_duration = 30.0  # Default fallback

    # Check if WhisperX is available
    try:
        import whisperx  # type: ignore
        return _transcribe_with_whisperx(audio_path, language)
    except ImportError:
        logger.info("WhisperX not installed, using mock transcription")
        return transcribe_audio_mock(audio_duration, language)


def _transcribe_with_whisperx(
    audio_path: str,
    language: str,
) -> TranscriptionResult:
    """Real WhisperX transcription (requires GPU + whisperx package).

    This implementation will be activated when:
    1. whisperx package is installed
    2. GPU is available (CUDA)
    3. The large-v3 model is downloaded

    Args:
        audio_path: Path to audio file
        language: Language code

    Returns:
        TranscriptionResult with real word-level alignment
    """
    import whisperx  # type: ignore
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"

    # Map our language codes to WhisperX language codes
    lang_map = {
        "hi_dev": "hi",
        "hi_rom": "hi",
        "en": "en",
    }
    whisper_lang = lang_map.get(language, "hi")

    logger.info("Loading WhisperX model (large-v3) on %s...", device)

    # Step 1: Load model and transcribe
    model = whisperx.load_model("large-v3", device, compute_type=compute_type)
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=16, language=whisper_lang)

    # Step 2: Align with word-level timestamps
    logger.info("Aligning word-level timestamps...")
    model_a, metadata = whisperx.load_align_model(
        language_code=whisper_lang, device=device
    )
    result = whisperx.align(
        result["segments"], model_a, metadata, audio, device,
        return_char_alignments=False,
    )

    # Step 3: Extract words with timing
    words: list[TranscriptionWord] = []
    line_index = 0

    for segment in result["segments"]:
        segment_words = segment.get("words", [])
        for w in segment_words:
            word_text = w.get("word", "").strip()
            if not word_text:
                continue

            words.append(TranscriptionWord(
                word=word_text,
                start=w.get("start", 0.0),
                end=w.get("end", 0.0),
                line_index=line_index,
            ))

        if segment_words:
            line_index += 1

    # Build raw text from segments
    raw_text = "\n".join(
        seg.get("text", "").strip()
        for seg in result["segments"]
        if seg.get("text", "").strip()
    )

    logger.info(
        "WhisperX transcription complete: %d words in %d lines",
        len(words), line_index,
    )

    return TranscriptionResult(words=words, raw_text=raw_text)
