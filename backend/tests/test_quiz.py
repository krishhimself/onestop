"""
Placeholder test — proves the app boots and the route is wired.
Extend with mocked github_client/gemini_client calls before relying
on this for real coverage.
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_ok():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
