"""
Thin HTTP layer for job postings, applications, and the company-side quiz.
No business logic here — logic lives in app/services/.

There is deliberately no plain "create a job" route. A posting exists only as the
output of a defended company quiz (generate -> submit -> followup), which is what
"the quiz gates job posting creation" has to mean to be worth anything: an ungated
create endpoint alongside it would make the gate decorative. Job creation itself
still lives in job_service.post_job(); company_quiz_service is its only caller.

The quiz routes are employer-only and each attempt belongs to the account that
generated it.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_employer
from app.schemas.job import (
    ApplicationRequest,
    CompanyQuizFollowUpRequest,
    CompanyQuizGenerateRequest,
    CompanyQuizGenerateResponse,
    CompanyQuizResultResponse,
    CompanyQuizSubmitRequest,
    CompanyQuizSubmitResponse,
)
from app.services import company_quiz_service, job_service

router = APIRouter()


@router.get("/")
async def list_jobs():
    return await job_service.get_jobs()


@router.post("/apply")
async def apply(application: ApplicationRequest):
    app_id = await job_service.apply_to_job(application.dict())
    return {"id": app_id}


# --- company quiz ----------------------------------------------------------


@router.post("/company-quiz/generate", response_model=CompanyQuizGenerateResponse)
async def generate_company_quiz(
    draft: CompanyQuizGenerateRequest, user: dict = Depends(get_current_employer)
):
    """Interrogates the draft posting. The draft is held server-side until grading."""
    try:
        return await company_quiz_service.create_quiz(draft.model_dump(), user["user_id"])
    except ValueError:
        raise HTTPException(400, "Couldn't build questions from that posting — add more detail about the role.")


@router.post("/company-quiz/submit", response_model=CompanyQuizSubmitResponse)
async def submit_company_quiz(
    req: CompanyQuizSubmitRequest, user: dict = Depends(get_current_employer)
):
    """Records answers and returns the adaptive follow-up. Does not grade or post."""
    try:
        return await company_quiz_service.start_followup(
            req.quiz_id, [a.model_dump() for a in req.answers], user["user_id"]
        )
    except LookupError:
        # Also the answer when the quiz exists but belongs to somebody else, so this
        # cannot be used to discover which quiz ids are real.
        raise HTTPException(404, "Quiz not found")
    except company_quiz_service.QuizClosed:
        raise HTTPException(409, "This quiz has already been graded.")
    except ValueError:
        raise HTTPException(400, "No answers submitted")


@router.post("/company-quiz/followup", response_model=CompanyQuizResultResponse)
async def company_quiz_followup(
    req: CompanyQuizFollowUpRequest, user: dict = Depends(get_current_employer)
):
    """Grades the round and, on a pass, publishes the posting that was defended."""
    try:
        return await company_quiz_service.grade_and_post(
            req.quiz_id, req.answer, user["user_id"], req.seconds_left
        )
    except LookupError:
        raise HTTPException(404, "Quiz not found")
    except company_quiz_service.QuizClosed:
        raise HTTPException(409, "Answer the follow-up round before grading.")
