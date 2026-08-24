"""
HTTP contract for the company-side quiz.

Two things are being pinned here. First the flow, which mirrors the candidate
quiz: generate -> submit -> followup, with /submit returning a follow-up rather
than a score. Second the gate itself: these routes are employer-only, and there
is no other way to create a job posting.
"""
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.services import company_quiz_service

EMPLOYER = {"Authorization": f"Bearer {create_access_token('test-employer', 'employer')}"}
CANDIDATE = {"Authorization": f"Bearer {create_access_token('test-user', 'candidate')}"}

client = TestClient(app, headers=EMPLOYER)
anon = TestClient(app)

DRAFT_BODY = {
    "company_name": "Acme",
    "role_title": "Backend Engineer",
    "description": "Own the ingest pipeline end to end.",
    "tech_stack": ["Python", "MongoDB"],
}


def generated(questions):
    return {"quiz_id": "cquiz-1", "role_title": "Backend Engineer",
            "questions": questions, "time_limit_seconds": 75}


def followup_payload(targets="cq2"):
    return {"quiz_id": "cquiz-1",
            "followup": {"id": "cf1", "question": "Who is on call?", "targets_question_id": targets},
            "time_limit_seconds": 75}


# --- the gate --------------------------------------------------------------

def test_there_is_no_ungated_way_to_create_a_job():
    """
    The whole feature is worthless if a plain POST /jobs/ still inserts a posting.
    This asserts the route is gone, not merely unused by the frontend.
    """
    resp = client.post("/api/v1/jobs/", json=DRAFT_BODY)
    assert resp.status_code in (404, 405)


def test_listing_jobs_still_works():
    """Reading postings is public; only creating one is gated."""
    with pytest.MonkeyPatch.context() as mp:
        from app.services import job_service
        mp.setattr(job_service, "get_jobs", AsyncMock(return_value=[]))
        assert anon.get("/api/v1/jobs/").status_code == 200


# --- auth ------------------------------------------------------------------

@pytest.mark.parametrize("path, body", [
    ("generate", DRAFT_BODY),
    ("submit", {"quiz_id": "cquiz-1", "answers": [{"question_id": "cq1", "answer": "a"}]}),
    ("followup", {"quiz_id": "cquiz-1", "answer": "a"}),
])
def test_every_company_quiz_route_rejects_an_anonymous_caller(path, body):
    assert anon.post(f"/api/v1/jobs/company-quiz/{path}", json=body).status_code == 401


@pytest.mark.parametrize("path, body", [
    ("generate", DRAFT_BODY),
    ("submit", {"quiz_id": "cquiz-1", "answers": [{"question_id": "cq1", "answer": "a"}]}),
    ("followup", {"quiz_id": "cquiz-1", "answer": "a"}),
])
def test_candidate_accounts_cannot_post_jobs(path, body):
    """The role is read off the signed token, so this cannot be forged in a body."""
    resp = TestClient(app, headers=CANDIDATE).post(f"/api/v1/jobs/company-quiz/{path}", json=body)
    assert resp.status_code == 403


def test_generate_is_refused_before_any_api_call_is_spent(monkeypatch):
    spy = AsyncMock()
    monkeypatch.setattr(company_quiz_service, "create_quiz", spy)
    TestClient(app, headers=CANDIDATE).post("/api/v1/jobs/company-quiz/generate", json=DRAFT_BODY)
    spy.assert_not_called()


# --- generate --------------------------------------------------------------

def test_generate_returns_questions_and_the_time_limit(monkeypatch, company_questions):
    monkeypatch.setattr(company_quiz_service, "create_quiz",
                        AsyncMock(return_value=generated(company_questions)))

    resp = client.post("/api/v1/jobs/company-quiz/generate", json=DRAFT_BODY)

    assert resp.status_code == 200
    body = resp.json()
    assert body["quiz_id"] == "cquiz-1"
    assert body["time_limit_seconds"] == 75
    assert [q["category"] for q in body["questions"]] == ["role", "stack", "team"]


def test_generate_forwards_the_draft_and_the_token_identity(monkeypatch, company_questions):
    spy = AsyncMock(return_value=generated(company_questions))
    monkeypatch.setattr(company_quiz_service, "create_quiz", spy)

    client.post("/api/v1/jobs/company-quiz/generate", json=DRAFT_BODY)

    draft, user_id = spy.call_args.args
    assert draft["role_title"] == "Backend Engineer"
    assert draft["tech_stack"] == ["Python", "MongoDB"]
    assert user_id == "test-employer"


def test_generate_requires_the_posting_fields():
    resp = client.post("/api/v1/jobs/company-quiz/generate", json={"company_name": "Acme"})
    assert resp.status_code == 422


def test_generate_maps_an_unusable_posting_to_400(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "create_quiz",
                        AsyncMock(side_effect=ValueError("no_questions")))
    resp = client.post("/api/v1/jobs/company-quiz/generate", json=DRAFT_BODY)
    assert resp.status_code == 400


# --- submit ----------------------------------------------------------------

def test_submit_returns_a_followup_and_no_score(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "start_followup",
                        AsyncMock(return_value=followup_payload()))

    resp = client.post("/api/v1/jobs/company-quiz/submit", json={
        "quiz_id": "cquiz-1", "answers": [{"question_id": "cq1", "answer": "a"}],
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["followup"]["targets_question_id"] == "cq2"
    assert "score" not in body
    assert "job_id" not in body


def test_submit_forwards_paste_flags_and_timing(monkeypatch):
    """The anti-gaming signals are useless if they do not survive the wire."""
    spy = AsyncMock(return_value=followup_payload("cq1"))
    monkeypatch.setattr(company_quiz_service, "start_followup", spy)

    client.post("/api/v1/jobs/company-quiz/submit", json={"quiz_id": "cquiz-1", "answers": [
        {"question_id": "cq1", "answer": "a", "seconds_left": 61.5,
         "flagged_paste": True, "paste_delta": 220},
    ]})

    sent = spy.call_args.args[1][0]
    assert sent["flagged_paste"] is True
    assert sent["paste_delta"] == 220
    assert sent["seconds_left"] == 61.5


def test_submit_defaults_paste_flags_when_the_client_omits_them(monkeypatch):
    spy = AsyncMock(return_value=followup_payload("cq1"))
    monkeypatch.setattr(company_quiz_service, "start_followup", spy)

    resp = client.post("/api/v1/jobs/company-quiz/submit", json={
        "quiz_id": "cquiz-1", "answers": [{"question_id": "cq1", "answer": "a"}],
    })

    assert resp.status_code == 200
    sent = spy.call_args.args[1][0]
    assert sent["flagged_paste"] is False
    assert sent["paste_delta"] == 0
    assert sent["seconds_left"] is None


def test_submit_unknown_quiz_is_404(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "start_followup", AsyncMock(side_effect=LookupError()))
    resp = client.post("/api/v1/jobs/company-quiz/submit", json={
        "quiz_id": "nope", "answers": [{"question_id": "cq1", "answer": "a"}],
    })
    assert resp.status_code == 404


def test_submit_on_a_graded_quiz_is_409(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "start_followup",
                        AsyncMock(side_effect=company_quiz_service.QuizClosed()))
    resp = client.post("/api/v1/jobs/company-quiz/submit", json={
        "quiz_id": "cquiz-1", "answers": [{"question_id": "cq1", "answer": "a"}],
    })
    assert resp.status_code == 409


def test_submit_with_no_answers_is_400(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "start_followup", AsyncMock(side_effect=ValueError()))
    resp = client.post("/api/v1/jobs/company-quiz/submit", json={"quiz_id": "cquiz-1", "answers": []})
    assert resp.status_code == 400


# --- followup / grading ----------------------------------------------------

def test_a_pass_returns_the_posting_it_created(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "grade_and_post", AsyncMock(return_value={
        "quiz_id": "cquiz-1", "score": 84.0, "pass_score": 70.0, "passed": True,
        "job_id": "job-1", "feedback": [{"question": "q", "score": 9, "note": "specific"}],
    }))

    resp = client.post("/api/v1/jobs/company-quiz/followup", json={
        "quiz_id": "cquiz-1", "answer": "our defence", "seconds_left": 12.0,
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["passed"] is True
    assert body["job_id"] == "job-1"
    assert body["score"] == 84.0
    assert body["feedback"][0]["note"] == "specific"


def test_a_fail_returns_no_posting(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "grade_and_post", AsyncMock(return_value={
        "quiz_id": "cquiz-1", "score": 31.0, "pass_score": 70.0, "passed": False,
        "job_id": None, "feedback": [],
    }))

    body = client.post("/api/v1/jobs/company-quiz/followup",
                       json={"quiz_id": "cquiz-1", "answer": "vague"}).json()

    assert body["passed"] is False
    assert body["job_id"] is None


def test_followup_accepts_a_blank_answer(monkeypatch):
    """A timed-out follow-up submits blank - that is a result, not an error."""
    monkeypatch.setattr(company_quiz_service, "grade_and_post", AsyncMock(return_value={
        "quiz_id": "cquiz-1", "score": 0.0, "pass_score": 70.0, "passed": False,
        "job_id": None, "feedback": [],
    }))
    resp = client.post("/api/v1/jobs/company-quiz/followup",
                       json={"quiz_id": "cquiz-1", "answer": ""})
    assert resp.status_code == 200
    assert resp.json()["score"] == 0.0


def test_followup_unknown_quiz_is_404(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "grade_and_post", AsyncMock(side_effect=LookupError()))
    resp = client.post("/api/v1/jobs/company-quiz/followup", json={"quiz_id": "nope", "answer": "a"})
    assert resp.status_code == 404


def test_grading_without_the_followup_round_is_409(monkeypatch):
    monkeypatch.setattr(company_quiz_service, "grade_and_post",
                        AsyncMock(side_effect=company_quiz_service.QuizClosed()))
    resp = client.post("/api/v1/jobs/company-quiz/followup",
                       json={"quiz_id": "cquiz-1", "answer": "a"})
    assert resp.status_code == 409
