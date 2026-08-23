"""Aggregates every v1 route. main.py only ever imports this one router."""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, jobs, profile, quiz

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
