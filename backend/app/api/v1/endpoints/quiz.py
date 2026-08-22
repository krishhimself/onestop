"""
Thin HTTP layer for the quiz feature. No business logic here — only
request/response translation and HTTP error mapping. Logic lives in
app/services/quiz_service.py.

Flow: generate -> submit (opens follow-up) -> followup (final grade).
Grading deliberately happens only after the follow-up, so a candidate
cannot bank a score and walk away from the round they cannot pass.
"""
from fastapi import APIRouter, HTTPException

from app.schemas.quiz import (
    FollowUpRequest,
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizResultResponse,
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
    """Records answers and returns the adaptive follow-up. Does not grade."""
    try:
        return await quiz_service.start_followup(
            req.quiz_id, [a.model_dump() for a in req.answers]
        )
    except LookupError:
        raise HTTPException(404, "Quiz not found")
    except ValueError:
        raise HTTPException(400, "No answers submitted")


@router.post("/followup", response_model=QuizResultResponse)
async def followup(req: FollowUpRequest):
    """Grades the original answers together with the follow-up defence."""
    try:
        result = await quiz_service.grade_quiz(req.quiz_id, req.answer, req.seconds_left)
    except LookupError:
        raise HTTPException(404, "Quiz not found")

    return {
        "quiz_id": req.quiz_id,
        "score": result["overall_score"],
        "breakdown": {"details": result["breakdown"]},
        "feedback": result["breakdown"],
    }
