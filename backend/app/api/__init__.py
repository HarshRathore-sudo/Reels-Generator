from fastapi import APIRouter
from app.api.projects import router as projects_router
from app.api.audio import router as audio_router
from app.api.lyrics import router as lyrics_router
from app.api.vibe import router as vibe_router
from app.api.visual import router as visual_router
from app.api.generation import router as generation_router
from app.api.jobs import router as jobs_router
from app.api.text_styles import router as text_styles_router

api_router = APIRouter(prefix="/api")

api_router.include_router(projects_router)
api_router.include_router(audio_router)
api_router.include_router(lyrics_router)
api_router.include_router(vibe_router)
api_router.include_router(visual_router)
api_router.include_router(generation_router)
api_router.include_router(jobs_router)
api_router.include_router(text_styles_router)
