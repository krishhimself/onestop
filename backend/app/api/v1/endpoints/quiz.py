"""
Thin HTTP layer for the quiz feature. No business logic here — only
request/response translation and HTTP error mapping. Logic lives in
app/services/quiz_service.py.

Every route here requires an access token. The quiz is a record of what a
specific person understood, so an unattributed attempt is not meaningful.

Flow: generate -> submit (opens follow-up) -> followup (final grade).
Grading deliberately happens only after the follow-up, so a candidate
cannot bank a score and walk away from the round they cannot pass.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user

from app.schemas.quiz import (
    BugHuntGenerateRequest,
    BugHuntGenerateResponse,
    BugHuntSubmitRequest,
    BugHuntSubmitResponse,
    Day1QuizGenerateRequest,
    Day1QuizGenerateResponse,
    FollowUpRequest,
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizResultResponse,
    QuizSubmitRequest,
    QuizSubmitResponse,
)
from app.services import bug_hunt_service, quiz_service

router = APIRouter()


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate(req: QuizGenerateRequest, user: dict = Depends(get_current_user)):
    try:
        return await quiz_service.create_quiz(req.repo_url, user["user_id"])
    except ValueError:
        raise HTTPException(400, "Couldn't read source files from that repo — make sure it's public.")


@router.post("/day1/generate", response_model=Day1QuizGenerateResponse)
async def generate_day1(req: Day1QuizGenerateRequest, user: dict = Depends(get_current_user)):
    try:
        return await quiz_service.create_day1_quiz(req.job_id, user["user_id"])
    except LookupError:
        raise HTTPException(404, "Job not found")
    except ValueError as e:
        if str(e) == "no_trial_repo":
            raise HTTPException(400, "This job posting does not have an attached trial repository.")
        raise HTTPException(400, "Couldn't read source files from the trial repository — make sure it's public.")


@router.post("/submit", response_model=QuizSubmitResponse)
async def submit(req: QuizSubmitRequest, user: dict = Depends(get_current_user)):
    """Records answers and returns the adaptive follow-up. Does not grade."""
    try:
        return await quiz_service.start_followup(
            req.quiz_id, [a.model_dump() for a in req.answers], user["user_id"]
        )
    except LookupError:
        # Also the answer when the quiz exists but belongs to somebody else, so
        # this cannot be used to discover which quiz ids are real.
        raise HTTPException(404, "Quiz not found")
    except ValueError:
        raise HTTPException(400, "No answers submitted")


@router.post("/followup", response_model=QuizResultResponse)
async def followup(req: FollowUpRequest, user: dict = Depends(get_current_user)):
    """Grades the original answers together with the follow-up defence."""
    try:
        result = await quiz_service.grade_quiz(
            req.quiz_id, req.answer, user["user_id"], req.seconds_left
        )
    except LookupError:
        # Also the answer when the quiz exists but belongs to somebody else, so
        # this cannot be used to discover which quiz ids are real.
        raise HTTPException(404, "Quiz not found")

    return {
        "quiz_id": req.quiz_id,
        "score": result["overall_score"],
        "breakdown": {"details": result["breakdown"]},
        "feedback": result["breakdown"],
    }


# --- Bug Hunt Mode Endpoints ---

@router.post("/bughunt/generate", response_model=BugHuntGenerateResponse)
async def generate_bughunt(req: BugHuntGenerateRequest, user: dict = Depends(get_current_user)):
    """
    Injects 2-3 subtle bugs into candidate repo working copies.
    Never returns the injected bug answer key to the client.
    """
    try:
        return await bug_hunt_service.create_bug_hunt(req.repo_url, user["user_id"])
    except ValueError:
        raise HTTPException(400, "Couldn't read source files from that repo — make sure it's public.")


@router.post("/bughunt/submit", response_model=BugHuntSubmitResponse)
async def submit_bughunt(req: BugHuntSubmitRequest, user: dict = Depends(get_current_user)):
    """
    Grades candidate's submitted findings against the server-side ground truth injected bugs.
    """
    try:
        return await bug_hunt_service.submit_and_grade_bug_hunt(
            req.bug_hunt_id, [f.model_dump() for f in req.findings], user["user_id"]
        )
    except LookupError:
        raise HTTPException(404, "Bug hunt challenge not found")

