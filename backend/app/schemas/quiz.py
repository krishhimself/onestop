"""Request/response DTOs for the quiz endpoints — what crosses the wire."""
from typing import List, Optional

from pydantic import BaseModel

# Seconds allowed per question, including the follow-up. The client enforces the
# countdown; the server treats it as the reference point for judging typing pace.
TIME_LIMIT_SECONDS = 75


class QuizGenerateRequest(BaseModel):
    repo_url: str
    user_id: Optional[str] = None


class QuizQuestion(BaseModel):
    id: str
    question: str
    file_reference: Optional[str] = None
    category: Optional[str] = None  # problem | logic | stack | usage


class ComplexityInfo(BaseModel):
    tier: str  # trivial | moderate | complex (| unknown if unrated)
    reasoning: str


class QuizGenerateResponse(BaseModel):
    quiz_id: str
    repo_url: str
    questions: List[QuizQuestion]
    complexity: ComplexityInfo
    time_limit_seconds: int = TIME_LIMIT_SECONDS


class QuizAnswer(BaseModel):
    question_id: str
    answer: str
    # Countdown remaining when the answer was committed. A long answer submitted with
    # most of the clock still left is the signal that it was not typed from scratch.
    seconds_left: Optional[float] = None
    # Client-observed paste signal: a single input event that added a paragraph.
    # Recorded silently — the candidate is never told it was noticed.
    flagged_paste: bool = False
    paste_delta: int = 0  # largest flagged single-event delta, used to rank flags


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    answers: List[QuizAnswer]


class FollowUpQuestion(BaseModel):
    id: str
    question: str
    targets_question_id: str


class QuizSubmitResponse(BaseModel):
    """Submitting answers no longer grades — it opens the follow-up round."""

    quiz_id: str
    followup: FollowUpQuestion
    time_limit_seconds: int = TIME_LIMIT_SECONDS


class FollowUpRequest(BaseModel):
    quiz_id: str
    answer: str
    seconds_left: Optional[float] = None


class QuizResultResponse(BaseModel):
    quiz_id: str
    score: float
    breakdown: dict
    feedback: List[dict]
