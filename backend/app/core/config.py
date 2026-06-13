from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:pass@postgres:5432/doles_reels"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "doles-reels"
    R2_ENDPOINT: str = ""
    R2_PUBLIC_URL: str = ""  # Optional public URL for R2 bucket (e.g. custom domain)

    # External APIs
    PEXELS_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # App
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
