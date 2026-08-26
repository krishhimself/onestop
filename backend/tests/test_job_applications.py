import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.services import job_service
from app.core.security import create_access_token

client = TestClient(app)

EMPLOYER_TOKEN = create_access_token("emp-1", "employer")
CANDIDATE_TOKEN = create_access_token("cand-1", "candidate")
OTHER_EMP_TOKEN = create_access_token("emp-2", "employer")


def test_employer_can_list_applications_for_their_jobs(monkeypatch):
    monkeypatch.setattr(job_service, "get_applications_for_employer", AsyncMock(return_value=[
        {
            "id": "app-1",
            "job_id": "job-1",
            "role_title": "Backend Architect",
            "company_name": "Acme",
            "user_id": "cand-1",
            "candidate_name": "Anonymous Candidate",
            "candidate_email": None,
            "revealed": False,
            "comprehension_score": 85.0,
            "day1_score": 92.0,
            "day1_quiz_id": "dquiz-1",
            "status": "applied",
            "applied_at": "2026-08-26T10:00:00",
        }
    ]))

    resp = client.get(
        "/api/v1/jobs/applications",
        headers={"Authorization": f"Bearer {EMPLOYER_TOKEN}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["candidate_name"] == "Anonymous Candidate"
    assert data[0]["comprehension_score"] == 85.0
    assert data[0]["day1_score"] == 92.0


def test_candidate_cannot_access_employer_applications_endpoint():
    resp = client.get(
        "/api/v1/jobs/applications",
        headers={"Authorization": f"Bearer {CANDIDATE_TOKEN}"}
    )
    assert resp.status_code == 403


def test_candidate_can_list_their_own_applications(monkeypatch):
    monkeypatch.setattr(job_service, "get_applications_for_candidate", AsyncMock(return_value=[
        {
            "id": "app-1",
            "job_id": "job-1",
            "role_title": "Backend Architect",
            "company_name": "Acme",
            "tech_stack": ["Python", "FastAPI"],
            "trial_repo_url": "https://github.com/acme/backend",
            "status": "reviewed",
            "day1_score": 92.0,
            "applied_at": "2026-08-26T10:00:00",
        }
    ]))

    resp = client.get(
        "/api/v1/jobs/my-applications",
        headers={"Authorization": f"Bearer {CANDIDATE_TOKEN}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["role_title"] == "Backend Architect"
    assert data[0]["status"] == "reviewed"


def test_employer_can_update_application_status(monkeypatch):
    monkeypatch.setattr(job_service, "update_application_status", AsyncMock(return_value={
        "id": "app-1",
        "status": "reviewed",
    }))

    resp = client.patch(
        "/api/v1/jobs/applications/app-1/status",
        json={"status": "reviewed"},
        headers={"Authorization": f"Bearer {EMPLOYER_TOKEN}"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "reviewed"


def test_update_status_maps_not_found_to_404(monkeypatch):
    monkeypatch.setattr(job_service, "update_application_status", AsyncMock(side_effect=LookupError("application_not_found")))

    resp = client.patch(
        "/api/v1/jobs/applications/missing-app/status",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {EMPLOYER_TOKEN}"}
    )
    assert resp.status_code == 404


def test_update_status_maps_unauthorized_to_403(monkeypatch):
    monkeypatch.setattr(job_service, "update_application_status", AsyncMock(side_effect=PermissionError("not_authorized")))

    resp = client.patch(
        "/api/v1/jobs/applications/app-1/status",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {OTHER_EMP_TOKEN}"}
    )
    assert resp.status_code == 403
