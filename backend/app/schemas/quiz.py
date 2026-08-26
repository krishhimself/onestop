"""Request/response DTOs for the quiz endpoints — what crosses the wire."""
from typing import List, Optional

from pydantic import BaseModel

# Seconds allowed per question, including the follow-up. The client enforces the
# countdown; the server treats it as the reference point for judging typing pace.
TIME_LIMIT_SECONDS = 75


class QuizGenerateRequest(BaseModel):
    repo_url: str
    # user_id is deliberately absent: it comes from the access token, so a caller
    # cannot attribute a quiz attempt to somebody else by editing the body.


class Day1QuizGenerateRequest(BaseModel):
    job_id: str


class Day1QuizGenerateResponse(BaseModel):
    quiz_id: str
    job_id: str
    repo_url: str
    questions: List[QuizQuestion]
    time_limit_seconds: int = TIME_LIMIT_SECONDS


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


# --- Bug Hunt Mode Schemas ---

class ModifiedFile(BaseModel):
    path: str
    content: str


class BugHuntGenerateRequest(BaseModel):
    repo_url: str


class BugHuntGenerateResponse(BaseModel):
    bug_hunt_id: str
    repo_url: str
    modified_files: List[ModifiedFile]
    time_limit_seconds: int = 180
    expected_bug_count: int


class BugFinding(BaseModel):
    file_path: str
    suspected_location: Optional[str] = None
    description: str
    seconds_left: Optional[float] = None
    flagged_paste: bool = False
    paste_delta: int = 0


class BugHuntSubmitRequest(BaseModel):
    bug_hunt_id: str
    findings: List[BugFinding]


class BugHuntSubmitResponse(BaseModel):
    bug_hunt_id: str
    score: float
    bugs_caught: int
    total_bugs: int
    breakdown: List[dict]
    summary: str

