"""
Tests for job postings, application flow, and Day-1 Readiness attachments.
"""
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.main import app
from app.services import job_service

client = TestClient(app)


async def test_apply_to_job_records_day1_quiz_id_and_score(monkeypatch):
    created_doc = {}

    async def fake_create_app(doc):
        created_doc.update(doc)

    monkeypatch.setattr(job_service.job_repository, "create_application", fake_create_app)

    payload = {
        "job_id": "job-100",
        "user_id": "cand-1",
        "day1_quiz_id": "dquiz-99",
        "day1_score": 85.0,
    }
    app_id = await job_service.apply_to_job(payload)

    assert app_id
    assert created_doc["_id"] == app_id
    assert created_doc["job_id"] == "job-100"
    assert created_doc["user_id"] == "cand-1"
    assert created_doc["day1_quiz_id"] == "dquiz-99"
    assert created_doc["day1_score"] == 85.0
    assert created_doc["status"] == "applied"


async def test_apply_to_job_resolves_score_from_graded_attempt_if_omitted(monkeypatch):
    created_doc = {}

    async def fake_create_app(doc):
        created_doc.update(doc)

    monkeypatch.setattr(job_service.job_repository, "create_application", fake_create_app)
    attempt = {
        "_id": "dquiz-99",
        "status": "graded",
        "result": {"overall_score": 92.0},
    }
    monkeypatch.setattr(job_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))

    payload = {
        "job_id": "job-100",
        "user_id": "cand-1",
        "day1_quiz_id": "dquiz-99",
    }
    app_id = await job_service.apply_to_job(payload)

    assert app_id
    assert created_doc["day1_score"] == 92.0


def test_apply_endpoint_forwards_day1_fields(monkeypatch):
    monkeypatch.setattr(job_service, "apply_to_job", AsyncMock(return_value="app-123"))

    resp = client.post("/api/v1/jobs/apply", json={
        "job_id": "job-100",
        "user_id": "cand-1",
        "day1_quiz_id": "dquiz-99",
        "day1_score": 88.0,
    })

    assert resp.status_code == 200
    assert resp.json() == {"id": "app-123"}
