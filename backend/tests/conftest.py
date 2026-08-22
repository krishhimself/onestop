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
