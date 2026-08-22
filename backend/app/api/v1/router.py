"""Aggregates every v1 route. main.py only ever imports this one router."""
from fastapi import APIRouter

from app.api.v1.endpoints import jobs, quiz

api_router = APIRouter()
api_router.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
