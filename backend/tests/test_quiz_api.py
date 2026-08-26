"""
HTTP contract for the quiz endpoints.

The flow is generate -> submit -> followup. /submit deliberately returns a
follow-up question rather than a score; anything relying on the old
score-at-submit behaviour should fail loudly here.
"""
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.services import quiz_service

# Every quiz route is behind the auth gate, so the client here is authenticated by
# default. Rejection of missing or bad tokens is covered in test_auth_api.py.
AUTH = {"Authorization": f"Bearer {create_access_token('test-user', 'candidate')}"}
client = TestClient(app, headers=AUTH)


def test_root_ok():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# --- generate --------------------------------------------------------------

def test_generate_returns_questions_complexity_and_time_limit(monkeypatch, questions, complexity):
    monkeypatch.setattr(quiz_service, "create_quiz", AsyncMock(return_value={
        "quiz_id": "quiz-1", "repo_url": "https://github.com/o/r",
        "questions": questions, "complexity": complexity, "time_limit_seconds": 75,
    }))
    resp = client.post("/api/v1/quiz/generate", json={"repo_url": "https://github.com/o/r"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["complexity"] == complexity
    assert body["time_limit_seconds"] == 75
    assert [q["category"] for q in body["questions"]] == ["problem", "logic", "stack"]


def test_generate_preserves_category_through_the_response_model(monkeypatch, questions, complexity):
    """response_model strips undeclared fields — category must be declared."""
    monkeypatch.setattr(quiz_service, "create_quiz", AsyncMock(return_value={
        "quiz_id": "quiz-1", "repo_url": "r", "questions": questions,
        "complexity": complexity, "time_limit_seconds": 75,
    }))
    body = client.post("/api/v1/quiz/generate", json={"repo_url": "r"}).json()
    assert all(q["category"] for q in body["questions"])


def test_generate_maps_no_source_files_to_400(monkeypatch):
    monkeypatch.setattr(quiz_service, "create_quiz", AsyncMock(side_effect=ValueError("no_source_files")))
    resp = client.post("/api/v1/quiz/generate", json={"repo_url": "https://github.com/o/r"})
    assert resp.status_code == 400


def test_generate_requires_repo_url():
    assert client.post("/api/v1/quiz/generate", json={}).status_code == 422


# --- day-1 generate --------------------------------------------------------

def test_generate_day1_returns_questions_and_job_id(monkeypatch):
    monkeypatch.setattr(quiz_service, "create_day1_quiz", AsyncMock(return_value={
        "quiz_id": "dquiz-1", "job_id": "j1", "repo_url": "https://github.com/org/repo",
        "questions": [{"id": "dq1", "question": "Where does data enter?", "category": "data_flow"}],
        "time_limit_seconds": 75,
    }))
    resp = client.post("/api/v1/quiz/day1/generate", json={"job_id": "j1"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["quiz_id"] == "dquiz-1"
    assert body["job_id"] == "j1"
    assert body["repo_url"] == "https://github.com/org/repo"
    assert body["questions"][0]["category"] == "data_flow"
    assert body["time_limit_seconds"] == 75


def test_generate_day1_maps_job_not_found_to_404(monkeypatch):
    monkeypatch.setattr(quiz_service, "create_day1_quiz", AsyncMock(side_effect=LookupError("job_not_found")))
    resp = client.post("/api/v1/quiz/day1/generate", json={"job_id": "missing"})
    assert resp.status_code == 404


def test_generate_day1_maps_no_trial_repo_to_400(monkeypatch):
    monkeypatch.setattr(quiz_service, "create_day1_quiz", AsyncMock(side_effect=ValueError("no_trial_repo")))
    resp = client.post("/api/v1/quiz/day1/generate", json={"job_id": "j1"})
    assert resp.status_code == 400


# --- submit ----------------------------------------------------------------

def test_submit_returns_a_followup_and_no_score(monkeypatch):
    monkeypatch.setattr(quiz_service, "start_followup", AsyncMock(return_value={
        "quiz_id": "quiz-1",
        "followup": {"id": "f1", "question": "You said X?", "targets_question_id": "q2"},
        "time_limit_seconds": 75,
    }))
    resp = client.post("/api/v1/quiz/submit", json={
        "quiz_id": "quiz-1",
        "answers": [{"question_id": "q1", "answer": "a"}],
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["followup"]["targets_question_id"] == "q2"
    assert "score" not in body


def test_submit_forwards_paste_flags_and_timing(monkeypatch):
    """The anti-gaming signals are useless if they do not survive the wire."""
    spy = AsyncMock(return_value={
        "quiz_id": "quiz-1",
        "followup": {"id": "f1", "question": "q?", "targets_question_id": "q1"},
        "time_limit_seconds": 75,
    })
    monkeypatch.setattr(quiz_service, "start_followup", spy)
    client.post("/api/v1/quiz/submit", json={"quiz_id": "quiz-1", "answers": [
        {"question_id": "q1", "answer": "a", "seconds_left": 61.5,
         "flagged_paste": True, "paste_delta": 220},
    ]})

    sent = spy.call_args.args[1][0]
    assert sent["flagged_paste"] is True
    assert sent["paste_delta"] == 220
    assert sent["seconds_left"] == 61.5


def test_submit_defaults_paste_flags_when_client_omits_them(monkeypatch):
    """An older client must not 500 the request."""
    spy = AsyncMock(return_value={
        "quiz_id": "quiz-1",
        "followup": {"id": "f1", "question": "q?", "targets_question_id": "q1"},
        "time_limit_seconds": 75,
    })
    monkeypatch.setattr(quiz_service, "start_followup", spy)
    resp = client.post("/api/v1/quiz/submit", json={
        "quiz_id": "quiz-1", "answers": [{"question_id": "q1", "answer": "a"}],
    })

    assert resp.status_code == 200
    sent = spy.call_args.args[1][0]
    assert sent["flagged_paste"] is False
    assert sent["paste_delta"] == 0
    assert sent["seconds_left"] is None


def test_submit_unknown_quiz_is_404(monkeypatch):
    monkeypatch.setattr(quiz_service, "start_followup", AsyncMock(side_effect=LookupError()))
    resp = client.post("/api/v1/quiz/submit", json={
        "quiz_id": "nope", "answers": [{"question_id": "q1", "answer": "a"}],
    })
    assert resp.status_code == 404


def test_submit_with_no_answers_is_400(monkeypatch):
    monkeypatch.setattr(quiz_service, "start_followup", AsyncMock(side_effect=ValueError()))
    resp = client.post("/api/v1/quiz/submit", json={"quiz_id": "quiz-1", "answers": []})
    assert resp.status_code == 400


# --- followup --------------------------------------------------------------

def test_followup_returns_the_final_score_and_breakdown(monkeypatch):
    monkeypatch.setattr(quiz_service, "grade_quiz", AsyncMock(return_value={
        "overall_score": 82.0,
        "breakdown": [{"question": "q1", "score": 8, "note": "solid"}],
    }))
    resp = client.post("/api/v1/quiz/followup", json={
        "quiz_id": "quiz-1", "answer": "my defence", "seconds_left": 12.0,
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 82.0
    assert body["feedback"] == body["breakdown"]["details"]
    assert body["feedback"][0]["note"] == "solid"


def test_followup_accepts_a_blank_answer(monkeypatch):
    """A timed-out follow-up submits blank — that is a result, not an error."""
    monkeypatch.setattr(quiz_service, "grade_quiz",
                        AsyncMock(return_value={"overall_score": 0.0, "breakdown": []}))
    resp = client.post("/api/v1/quiz/followup", json={"quiz_id": "quiz-1", "answer": ""})
    assert resp.status_code == 200
    assert resp.json()["score"] == 0.0


def test_followup_unknown_quiz_is_404(monkeypatch):
    monkeypatch.setattr(quiz_service, "grade_quiz", AsyncMock(side_effect=LookupError()))
    resp = client.post("/api/v1/quiz/followup", json={"quiz_id": "nope", "answer": "a"})
    assert resp.status_code == 404
