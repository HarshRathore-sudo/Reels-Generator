"""yt-dlp service for downloading YouTube videos.
Implementation in Phase 9.
"""


class YtdlpService:
    """Handles YouTube video downloads via yt-dlp."""

    def __init__(self) -> None:
        pass

    async def download(self, url: str, output_dir: str) -> str:
        """Download video from YouTube URL. Returns path to downloaded file."""
        raise NotImplementedError("Phase 9")
