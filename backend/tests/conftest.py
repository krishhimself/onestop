"""
Shared fixtures.

Every test here is hermetic: Gemini and Mongo are always mocked, so the suite
never spends API quota, never needs credentials, and passes in CI where no .env
exists. If a test in this package makes a real network call, that is a bug in the
test.
"""
import pytest

QUESTIONS = [
    {"id": "q1", "question": "Why a Session?", "file_reference": "sessions.py", "category": "problem"},
    {"id": "q2", "question": "How does preparation work?", "file_reference": "models.py", "category": "logic"},
    {"id": "q3", "question": "Why urllib3?", "file_reference": "adapters.py", "category": "stack"},
]

COMPLEXITY = {"tier": "complex", "reasoning": "many interacting parts"}


@pytest.fixture
def questions():
    return [dict(q) for q in QUESTIONS]


@pytest.fixture
def complexity():
    return dict(COMPLEXITY)


@pytest.fixture
def attempt(questions, complexity):
    """A stored quiz_attempts document mid-flow, awaiting its follow-up."""
    return {
        "_id": "quiz-1",
        "repo_url": "https://github.com/psf/requests",
        "user_id": "u1",
        "questions": questions,
        "complexity": complexity,
        "answers": [
            {"question_id": "q1", "answer": "typed reply", "seconds_left": 4.0,
             "flagged_paste": False, "paste_delta": 0},
            {"question_id": "q2", "answer": "x" * 300, "seconds_left": 68.0,
             "flagged_paste": True, "paste_delta": 300},
        ],
        "followup": {
            "id": "f1",
            "question": "You said X — what happens if Y throws?",
            "targets_question_id": "q2",
            "answer": None,
        },
        "status": "awaiting_followup",
    }


COMPANY_QUESTIONS = [
    {"id": "cq1", "question": "What does this hire do in their first week?", "category": "role"},
    {"id": "cq2", "question": "Which of the six listed technologies do they touch daily?", "category": "stack"},
    {"id": "cq3", "question": "Who decides what they build?", "category": "team"},
]

DRAFT = {
    "company_name": "Acme",
    "role_title": "Backend Engineer",
    "description": "Own the ingest pipeline end to end.",
    "tech_stack": ["Python", "MongoDB"],
    "trial_repo_url": None,
}


@pytest.fixture
def draft():
    return dict(DRAFT)


@pytest.fixture
def company_questions():
    return [dict(q) for q in COMPANY_QUESTIONS]


@pytest.fixture
def company_attempt(company_questions, draft):
    """A stored company_quiz_attempts document mid-flow, awaiting its follow-up."""
    return {
        "_id": "cquiz-1",
        "user_id": "e1",
        "draft": draft,
        "questions": company_questions,
        "answers": [
            {"question_id": "cq1", "answer": "typed reply", "seconds_left": 6.0,
             "flagged_paste": False, "paste_delta": 0},
            {"question_id": "cq2", "answer": "x" * 400, "seconds_left": 70.0,
             "flagged_paste": True, "paste_delta": 400},
        ],
        "followup": {
            "id": "cf1",
            "question": "You said they own ingest — who is on call for it today?",
            "targets_question_id": "cq2",
            "answer": None,
        },
        "status": "awaiting_followup",
    }
