"""
Thin HTTP layer for the quiz feature. No business logic here — only
request/response translation and HTTP error mapping. Logic lives in
app/services/quiz_service.py.
"""
from fastapi import APIRouter, HTTPException

from app.schemas.quiz import (
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizSubmitRequest,
    QuizSubmitResponse,
)
from app.services import quiz_service

router = APIRouter()


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate(req: QuizGenerateRequest):
    try:
        return await quiz_service.create_quiz(req.repo_url, req.user_id)
    except ValueError:
        raise HTTPException(400, "Couldn't read source files from that repo — make sure it's public.")


@router.post("/submit", response_model=QuizSubmitResponse)
async def submit(req: QuizSubmitRequest):
    try:
        result = await quiz_service.grade_quiz(req.quiz_id, [a.dict() for a in req.answers])
    except LookupError:
        raise HTTPException(404, "Quiz not found")

    return {
        "quiz_id": req.quiz_id,
        "score": result["overall_score"],
        "breakdown": {"details": result["breakdown"]},
        "feedback": result["breakdown"],
    }
