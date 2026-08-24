"""
HTTP contract for connections and the post feed.

Writing needs a token and the author comes off it; reading is open, like profiles
and reputation. The response models are pinned because `response_model` strips
undeclared fields — an author summary that loses `revealed` would render a name
the funnel says nobody may see.
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.services import community_service

NOW = datetime(2026, 8, 24, tzinfo=timezone.utc)
AUTH = {"Authorization": f"Bearer {create_access_token('u1', 'candidate')}"}

client = TestClient(app, headers=AUTH)
anon = TestClient(app)

HIDDEN_AUTHOR = {"user_id": "u3", "name": "Anonymous Candidate", "revealed": False}


# --- connections ------------------------------------------------------------

def test_connect_uses_the_caller_from_the_token(monkeypatch):
    spy = AsyncMock(return_value={"connection_id": "c1", "user_id": "u1",
                                  "connected_to": "u2", "created": True})
    monkeypatch.setattr(community_service, "connect", spy)

    resp = client.post("/api/v1/users/u2/connect")

    assert resp.status_code == 200
    assert resp.json()["created"] is True
    assert spy.call_args.args == ("u1", "u2"), "caller from the token, target from the path"


def test_connecting_twice_reports_created_false(monkeypatch):
    monkeypatch.setattr(community_service, "connect", AsyncMock(return_value={
        "connection_id": "c1", "user_id": "u1", "connected_to": "u2", "created": False,
    }))
    assert client.post("/api/v1/users/u2/connect").json()["created"] is False


def test_connecting_needs_a_token():
    assert anon.post("/api/v1/users/u2/connect").status_code == 401


def test_connecting_to_yourself_is_400(monkeypatch):
    monkeypatch.setattr(community_service, "connect", AsyncMock(side_effect=ValueError()))
    assert client.post("/api/v1/users/u1/connect").status_code == 400


def test_connecting_to_an_unknown_user_is_404(monkeypatch):
    monkeypatch.setattr(community_service, "connect", AsyncMock(side_effect=LookupError()))
    assert client.post("/api/v1/users/ghost/connect").status_code == 404


def test_the_connections_list_is_open_and_keeps_the_reveal_flag(monkeypatch):
    monkeypatch.setattr(community_service, "list_connections", AsyncMock(return_value={
        "user_id": "u1", "count": 1,
        "connections": [{**HIDDEN_AUTHOR, "connected_at": NOW}],
    }))

    body = anon.get("/api/v1/users/u1/connections").json()

    assert body["count"] == 1
    assert body["connections"][0]["revealed"] is False
    assert body["connections"][0]["name"] == "Anonymous Candidate"


def test_listing_connections_for_an_unknown_user_is_404(monkeypatch):
    monkeypatch.setattr(community_service, "list_connections",
                        AsyncMock(side_effect=LookupError()))
    assert anon.get("/api/v1/users/ghost/connections").status_code == 404


# --- posts ------------------------------------------------------------------

def post_view(**over):
    return {"post_id": "p1", "author": dict(HIDDEN_AUTHOR), "text": "hello",
            "job_id": None, "company_name": None, "created_at": NOW, **over}


def test_creating_a_post_attributes_it_to_the_token(monkeypatch):
    spy = AsyncMock(return_value=post_view())
    monkeypatch.setattr(community_service, "create_post", spy)

    resp = client.post("/api/v1/posts/", json={"text": "hello"})

    assert resp.status_code == 201
    assert spy.call_args.args[0] == "u1", "author is never read from the body"


def test_an_author_field_in_the_body_is_ignored(monkeypatch):
    """Otherwise anyone could post as anyone."""
    spy = AsyncMock(return_value=post_view())
    monkeypatch.setattr(community_service, "create_post", spy)

    client.post("/api/v1/posts/", json={"text": "hello", "author_id": "somebody-else"})

    assert spy.call_args.args[0] == "u1"


def test_a_post_may_carry_a_job_reference(monkeypatch):
    spy = AsyncMock(return_value=post_view(job_id="job-1", company_name="Acme"))
    monkeypatch.setattr(community_service, "create_post", spy)

    body = client.post("/api/v1/posts/", json={
        "text": "we are hiring", "job_id": "job-1", "company_name": "Acme",
    }).json()

    assert spy.call_args.args[1:] == ("we are hiring", "job-1", "Acme")
    assert body["job_id"] == "job-1"


def test_posting_needs_a_token():
    assert anon.post("/api/v1/posts/", json={"text": "hello"}).status_code == 401


@pytest.mark.parametrize("payload", [
    {},
    {"text": ""},
    {"text": "x" * (community_service.MAX_POST_LENGTH + 1)},
])
def test_post_validation(payload):
    assert client.post("/api/v1/posts/", json=payload).status_code == 422


def test_a_post_referencing_a_missing_job_is_404(monkeypatch):
    monkeypatch.setattr(community_service, "create_post", AsyncMock(side_effect=LookupError()))
    resp = client.post("/api/v1/posts/", json={"text": "see this", "job_id": "nope"})
    assert resp.status_code == 404


def test_the_feed_is_open_to_read(monkeypatch):
    monkeypatch.setattr(community_service, "list_posts", AsyncMock(return_value={
        "total": 1, "limit": 20, "skip": 0, "posts": [post_view()],
    }))

    body = anon.get("/api/v1/posts/").json()

    assert body["total"] == 1
    assert body["posts"][0]["author"]["revealed"] is False


def test_the_feed_forwards_paging(monkeypatch):
    spy = AsyncMock(return_value={"total": 0, "limit": 5, "skip": 10, "posts": []})
    monkeypatch.setattr(community_service, "list_posts", spy)

    anon.get("/api/v1/posts/?limit=5&skip=10")

    assert spy.call_args.kwargs == {"limit": 5, "skip": 10}


@pytest.mark.parametrize("query", ["limit=0", "limit=999", "skip=-1"])
def test_the_feed_rejects_nonsense_paging(query):
    assert anon.get(f"/api/v1/posts/?{query}").status_code == 422


def test_there_are_no_comment_like_or_reaction_routes():
    """Scope guard: the feed creates and lists, and that is all it does."""
    paths = app.openapi()["paths"]
    for word in ("comment", "like", "reaction", "reply", "message"):
        assert not [p for p in paths if word in p.lower()], f"unexpected {word} route"
