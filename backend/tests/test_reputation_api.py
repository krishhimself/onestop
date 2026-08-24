"""
HTTP contract for GET /users/{user_id}/reputation.

The response model is the thing being pinned: response_model strips undeclared
fields, so a component that is not declared silently stops crossing the wire and
the page renders a bare number instead of a breakdown.
"""
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.main import app
from app.services import reputation_service

client = TestClient(app)

BREAKDOWN = {"overall": 66, "comprehension": 80, "quiz_count": 2, "rounds_reached": 1}


def test_the_breakdown_survives_the_response_model(monkeypatch):
    monkeypatch.setattr(reputation_service, "compute_reputation",
                        AsyncMock(return_value=dict(BREAKDOWN)))

    resp = client.get("/api/v1/users/u1/reputation")

    assert resp.status_code == 200
    assert resp.json() == {"user_id": "u1", **BREAKDOWN}


def test_a_new_account_is_zeros_rather_than_a_404(monkeypatch):
    monkeypatch.setattr(reputation_service, "compute_reputation", AsyncMock(return_value={
        "overall": 0, "comprehension": 0, "quiz_count": 0, "rounds_reached": 0,
    }))

    resp = client.get("/api/v1/users/fresh/reputation")

    assert resp.status_code == 200
    assert resp.json()["overall"] == 0
    assert resp.json()["quiz_count"] == 0


def test_an_unknown_user_is_404(monkeypatch):
    monkeypatch.setattr(reputation_service, "compute_reputation",
                        AsyncMock(side_effect=LookupError()))
    assert client.get("/api/v1/users/nobody/reputation").status_code == 404


def test_reading_a_reputation_needs_no_token(monkeypatch):
    """Open like profiles: the payload carries no identity, only what was earned."""
    monkeypatch.setattr(reputation_service, "compute_reputation",
                        AsyncMock(return_value=dict(BREAKDOWN)))
    assert TestClient(app).get("/api/v1/users/u1/reputation").status_code == 200
