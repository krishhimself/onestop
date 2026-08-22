"""
Auth endpoints and the token gate on the quiz flow.

The gate is the point of the feature: a quiz attempt records what a specific
person understood, so an unattributed or forgeable attribution is worthless.
"""
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.main import app
from app.services import auth_service, quiz_service

client = TestClient(app)


@pytest.fixture
def no_such_user(monkeypatch):
    monkeypatch.setattr(auth_service.user_repository, "get_user_by_email", AsyncMock(return_value=None))
    created = AsyncMock()
    monkeypatch.setattr(auth_service.user_repository, "create_user", created)
    return created


@pytest.fixture
def existing_user(monkeypatch):
    user = {"_id": "user-1", "email": "a@b.com",
            "hashed_password": hash_password("hunter2hunter2"), "role": "candidate"}
    monkeypatch.setattr(auth_service.user_repository, "get_user_by_email", AsyncMock(return_value=user))
    return user


def auth_header(user_id="user-1", role="candidate"):
    return {"Authorization": f"Bearer {create_access_token(user_id, role)}"}


# --- register --------------------------------------------------------------

def test_register_creates_a_user_and_returns_a_token(no_such_user):
    resp = client.post("/api/v1/auth/register",
                       json={"email": "New@Example.com", "password": "hunter2hunter2", "role": "employer"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["token_type"] == "bearer" and body["role"] == "employer"
    assert body["access_token"]

    doc = no_such_user.call_args.args[0]
    assert doc["email"] == "new@example.com", "email must be stored folded"
    assert doc["role"] == "employer"
    assert "password" not in doc
    assert doc["hashed_password"] != "hunter2hunter2"


def test_register_rejects_a_duplicate_email(existing_user):
    resp = client.post("/api/v1/auth/register",
                       json={"email": "a@b.com", "password": "hunter2hunter2"})
    assert resp.status_code == 409


def test_register_defaults_to_candidate(no_such_user):
    client.post("/api/v1/auth/register", json={"email": "c@d.com", "password": "hunter2hunter2"})
    assert no_such_user.call_args.args[0]["role"] == "candidate"


@pytest.mark.parametrize("payload", [
    {"email": "not-an-email", "password": "hunter2hunter2"},
    {"email": "a@b.com", "password": "short"},
    {"email": "a@b.com", "password": "x" * 73},
    {"email": "a@b.com", "password": "hunter2hunter2", "role": "admin"},
    {"password": "hunter2hunter2"},
])
def test_register_validation(payload):
    assert client.post("/api/v1/auth/register", json=payload).status_code == 422


# --- login -----------------------------------------------------------------

def test_login_returns_a_usable_token(existing_user):
    resp = client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "hunter2hunter2"})
    assert resp.status_code == 200
    from app.core.security import decode_access_token
    assert decode_access_token(resp.json()["access_token"])["sub"] == "user-1"


def test_login_with_wrong_password_is_401(existing_user):
    resp = client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "wrongwrongwrong"})
    assert resp.status_code == 401


def test_login_does_not_reveal_whether_the_account_exists(monkeypatch, existing_user):
    wrong_password = client.post("/api/v1/auth/login",
                                 json={"email": "a@b.com", "password": "wrongwrongwrong"})
    monkeypatch.setattr(auth_service.user_repository, "get_user_by_email", AsyncMock(return_value=None))
    unknown_email = client.post("/api/v1/auth/login",
                                json={"email": "nobody@b.com", "password": "wrongwrongwrong"})

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json(), "responses must be indistinguishable"


# --- the gate --------------------------------------------------------------

@pytest.mark.parametrize("path,payload", [
    ("/api/v1/quiz/generate", {"repo_url": "https://github.com/o/r"}),
    ("/api/v1/quiz/submit", {"quiz_id": "q", "answers": [{"question_id": "a", "answer": "b"}]}),
    ("/api/v1/quiz/followup", {"quiz_id": "q", "answer": "b"}),
])
def test_quiz_endpoints_reject_requests_with_no_token(path, payload):
    assert client.post(path, json=payload).status_code == 401


@pytest.mark.parametrize("header", [
    {"Authorization": "Bearer garbage"},
    {"Authorization": "Bearer "},
    {"Authorization": "token abc"},
    {"Authorization": ""},
])
def test_quiz_endpoints_reject_bad_authorization_headers(header):
    resp = client.post("/api/v1/quiz/submit",
                       json={"quiz_id": "q", "answers": [{"question_id": "a", "answer": "b"}]},
                       headers=header)
    assert resp.status_code == 401


def test_expired_token_is_rejected_by_the_gate():
    stale = create_access_token("user-1", "candidate", expires_minutes=-1)
    resp = client.post("/api/v1/quiz/submit",
                       json={"quiz_id": "q", "answers": [{"question_id": "a", "answer": "b"}]},
                       headers={"Authorization": f"Bearer {stale}"})
    assert resp.status_code == 401


def test_submit_succeeds_with_a_valid_token(monkeypatch):
    monkeypatch.setattr(quiz_service, "start_followup", AsyncMock(return_value={
        "quiz_id": "q", "time_limit_seconds": 75,
        "followup": {"id": "f1", "question": "q?", "targets_question_id": "a"},
    }))
    resp = client.post("/api/v1/quiz/submit",
                       json={"quiz_id": "q", "answers": [{"question_id": "a", "answer": "b"}]},
                       headers=auth_header())
    assert resp.status_code == 200


def test_generate_attributes_the_quiz_to_the_token_not_the_body(monkeypatch, questions, complexity):
    """The whole point of the gate: user_id must not be forgeable from the body."""
    spy = AsyncMock(return_value={"quiz_id": "q", "repo_url": "r", "questions": questions,
                                  "complexity": complexity, "time_limit_seconds": 75})
    monkeypatch.setattr(quiz_service, "create_quiz", spy)

    resp = client.post("/api/v1/quiz/generate",
                       json={"repo_url": "https://github.com/o/r", "user_id": "somebody-else"},
                       headers=auth_header(user_id="real-user"))

    assert resp.status_code == 200
    assert spy.call_args.args[1] == "real-user"


# --- ownership at the HTTP boundary ---------------------------------------


def test_another_user_cannot_submit_against_your_quiz(monkeypatch):
    """
    Being logged in is not enough. Before this, any authenticated caller who knew
    or guessed a quiz_id could answer somebody else's quiz, which made the
    attribution the token establishes meaningless.
    """
    attempt = {"_id": "quiz-1", "user_id": "owner", "questions": [{"id": "a", "question": "q"}]}
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    gen = AsyncMock(return_value="follow-up?")
    monkeypatch.setattr(quiz_service.gemini_client, "generate_followup_question", gen)
    monkeypatch.setattr(quiz_service.quiz_repository, "update_followup", AsyncMock())

    body = {"quiz_id": "quiz-1", "answers": [{"question_id": "a", "answer": "b"}]}
    intruder = client.post("/api/v1/quiz/submit", json=body, headers=auth_header("intruder"))

    assert intruder.status_code == 404
    gen.assert_not_called(), "must refuse before spending an API call"


def test_another_user_cannot_grade_your_quiz(monkeypatch):
    attempt = {"_id": "quiz-1", "user_id": "owner", "questions": [], "answers": [], "followup": {}}
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    grade = AsyncMock()
    monkeypatch.setattr(quiz_service.gemini_client, "grade_answers", grade)

    resp = client.post("/api/v1/quiz/followup",
                       json={"quiz_id": "quiz-1", "answer": "defence"},
                       headers=auth_header("intruder"))

    assert resp.status_code == 404
    grade.assert_not_called()


def test_a_foreign_quiz_looks_exactly_like_a_missing_one(monkeypatch):
    """Otherwise the 404/403 split would leak which quiz ids exist."""
    body = {"quiz_id": "quiz-1", "answers": [{"question_id": "a", "answer": "b"}]}

    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=None))
    missing = client.post("/api/v1/quiz/submit", json=body, headers=auth_header("intruder"))

    attempt = {"_id": "quiz-1", "user_id": "owner", "questions": [{"id": "a", "question": "q"}]}
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    foreign = client.post("/api/v1/quiz/submit", json=body, headers=auth_header("intruder"))

    assert missing.status_code == foreign.status_code == 404
    assert missing.json() == foreign.json()


def test_the_owner_can_still_submit(monkeypatch):
    attempt = {"_id": "quiz-1", "user_id": "owner", "questions": [{"id": "a", "question": "q"}]}
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    monkeypatch.setattr(quiz_service.gemini_client, "generate_followup_question",
                        AsyncMock(return_value="follow-up?"))
    monkeypatch.setattr(quiz_service.quiz_repository, "update_followup", AsyncMock())

    resp = client.post("/api/v1/quiz/submit",
                       json={"quiz_id": "quiz-1", "answers": [{"question_id": "a", "answer": "b"}]},
                       headers=auth_header("owner"))

    assert resp.status_code == 200
    assert resp.json()["followup"]["targets_question_id"] == "a"
