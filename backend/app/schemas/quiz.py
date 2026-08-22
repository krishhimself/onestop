"""Request/response DTOs for the quiz endpoints — what crosses the wire."""
from typing import List, Optional

from pydantic import BaseModel


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


class QuizAnswer(BaseModel):
    question_id: str
    answer: str


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    answers: List[QuizAnswer]


class QuizSubmitResponse(BaseModel):
    quiz_id: str
    score: float
    breakdown: dict
    feedback: List[dict]
