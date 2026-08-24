"""Request/response DTOs for the jobs endpoints."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.quiz import (
    TIME_LIMIT_SECONDS,
    FollowUpQuestion,
    QuizAnswer,
    QuizQuestion,
)


class JobCreateRequest(BaseModel):
    company_name: str
    role_title: str
    description: str
    tech_stack: List[str] = []


class JobResponse(BaseModel):
    id: str
    company_name: str
    role_title: str
    description: str
    tech_stack: List[str]
    posted_at: Optional[datetime] = None


class ApplicationRequest(BaseModel):
    job_id: str
    user_id: str
    quiz_score_id: Optional[str] = None


# --- company quiz ----------------------------------------------------------
#
# The DTOs below deliberately reuse QuizAnswer, QuizQuestion and FollowUpQuestion
# from schemas/quiz.py rather than redeclaring them. The two sides of the market
# run the same engine, so the anti-gaming fields (seconds_left, flagged_paste,
# paste_delta) must stay one definition — a company-side copy would drift.


class CompanyQuizGenerateRequest(JobCreateRequest):
    """
    The draft posting itself. Questions are generated from it, and it is stored on
    the attempt — the job is later created from that stored copy, never from a
    second body sent at the end, so a passing quiz cannot be redeemed against a
    different posting than the one that was defended.
    """


class CompanyQuizGenerateResponse(BaseModel):
    quiz_id: str
    role_title: str
    questions: List[QuizQuestion]
    time_limit_seconds: int = TIME_LIMIT_SECONDS


class CompanyQuizSubmitRequest(BaseModel):
    quiz_id: str
    answers: List[QuizAnswer]


class CompanyQuizSubmitResponse(BaseModel):
    """Like the candidate flow, submitting opens the follow-up rather than grading."""

    quiz_id: str
    followup: FollowUpQuestion
    time_limit_seconds: int = TIME_LIMIT_SECONDS


class CompanyQuizFollowUpRequest(BaseModel):
    quiz_id: str
    answer: str
    seconds_left: Optional[float] = None


class CompanyQuizResultResponse(BaseModel):
    quiz_id: str
    score: float
    pass_score: float
    passed: bool
    # The posting that was created, or None when the quiz did not clear the bar.
    # This is the whole gate: no other route creates a job.
    job_id: Optional[str] = None
    feedback: List[dict]
