"""
Connections and the post feed.

Two things carry weight here. Connections are instant and mutual, so the stored
shape has to be one document that reads the same from either side. And both
surfaces list other people, which makes them the two places the anonymous funnel
could quietly spring a leak.
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.repositories.connection_repository import pair
from app.services import community_service
from app.services.reputation_service import ANONYMOUS_NAME

NOW = datetime(2026, 8, 24, tzinfo=timezone.utc)

REVEALED = {"_id": "u2", "name": "Ada Lovelace", "revealed": True}
HIDDEN = {"_id": "u3", "name": "Grace Hopper", "revealed": False}


def patch_users(monkeypatch, by_id, exists=True):
    monkeypatch.setattr(community_service.user_repository, "get_users_by_ids",
                        AsyncMock(return_value=by_id))
    monkeypatch.setattr(community_service.user_repository, "get_user_by_id",
                        AsyncMock(return_value={"_id": "u2"} if exists else None))


# --- connections ------------------------------------------------------------

async def test_connecting_is_instant_and_has_no_pending_state(monkeypatch):
    patch_users(monkeypatch, {})
    monkeypatch.setattr(community_service.connection_repository, "get_connection",
                        AsyncMock(return_value=None))
    created = AsyncMock(return_value={"_id": "c1", "users": pair("u1", "u2")})
    monkeypatch.setattr(community_service.connection_repository, "create_connection", created)

    out = await community_service.connect("u1", "u2")

    assert out["created"] is True
    assert out["connected_to"] == "u2"
    doc_fields = created.call_args.args
    assert doc_fields[1:] == ("u1", "u2")


async def test_the_pair_is_stored_once_in_canonical_order():
    """One document, findable from either side — not two directed rows."""
    assert pair("u2", "u1") == pair("u1", "u2") == ["u1", "u2"]


async def test_connecting_twice_is_a_no_op(monkeypatch):
    """No approval flow means a repeat has no state to advance; erroring would
    only punish a double-click."""
    patch_users(monkeypatch, {})
    monkeypatch.setattr(community_service.connection_repository, "get_connection",
                        AsyncMock(return_value={"_id": "c1", "users": pair("u1", "u2")}))
    created = AsyncMock()
    monkeypatch.setattr(community_service.connection_repository, "create_connection", created)

    out = await community_service.connect("u1", "u2")

    assert out["created"] is False
    assert out["connection_id"] == "c1"
    created.assert_not_called()


async def test_connecting_to_yourself_is_refused(monkeypatch):
    patch_users(monkeypatch, {})
    with pytest.raises(ValueError):
        await community_service.connect("u1", "u1")


async def test_connecting_to_an_unknown_user_is_refused(monkeypatch):
    patch_users(monkeypatch, {}, exists=False)
    created = AsyncMock()
    monkeypatch.setattr(community_service.connection_repository, "create_connection", created)

    with pytest.raises(LookupError):
        await community_service.connect("u1", "ghost")
    created.assert_not_called()


async def test_the_connections_list_returns_the_other_side(monkeypatch):
    patch_users(monkeypatch, {"u2": REVEALED, "u3": HIDDEN})
    monkeypatch.setattr(community_service.connection_repository, "list_for_user",
                        AsyncMock(return_value=[
                            {"_id": "c1", "users": pair("u1", "u2"), "created_at": NOW},
                            {"_id": "c2", "users": pair("u1", "u3"), "created_at": NOW},
                        ]))

    out = await community_service.list_connections("u1")

    assert out["count"] == 2
    assert [c["user_id"] for c in out["connections"]] == ["u2", "u3"]
    assert "u1" not in [c["user_id"] for c in out["connections"]]


async def test_listing_connections_for_an_unknown_user_raises(monkeypatch):
    patch_users(monkeypatch, {}, exists=False)
    with pytest.raises(LookupError):
        await community_service.list_connections("ghost")


# --- the funnel must not leak ----------------------------------------------

async def test_an_unrevealed_connection_is_a_pseudonym(monkeypatch):
    """The connections list must not be the place a hidden name escapes."""
    patch_users(monkeypatch, {"u3": HIDDEN})
    monkeypatch.setattr(community_service.connection_repository, "list_for_user",
                        AsyncMock(return_value=[
                            {"_id": "c2", "users": pair("u1", "u3"), "created_at": NOW},
                        ]))

    shown = (await community_service.list_connections("u1"))["connections"][0]

    assert shown["name"] == ANONYMOUS_NAME
    assert shown["revealed"] is False
    assert "Grace" not in str(shown), "the real name must not be in the payload at all"


async def test_a_revealed_connection_shows_their_name(monkeypatch):
    patch_users(monkeypatch, {"u2": REVEALED})
    monkeypatch.setattr(community_service.connection_repository, "list_for_user",
                        AsyncMock(return_value=[
                            {"_id": "c1", "users": pair("u1", "u2"), "created_at": NOW},
                        ]))

    shown = (await community_service.list_connections("u1"))["connections"][0]

    assert shown["name"] == "Ada Lovelace" and shown["revealed"] is True


async def test_an_unrevealed_author_posts_under_the_pseudonym(monkeypatch):
    patch_users(monkeypatch, {"u3": HIDDEN})
    monkeypatch.setattr(community_service.post_repository, "list_posts",
                        AsyncMock(return_value=[
                            {"_id": "p1", "author_id": "u3", "text": "hello", "created_at": NOW},
                        ]))
    monkeypatch.setattr(community_service.post_repository, "count_posts", AsyncMock(return_value=1))

    post = (await community_service.list_posts())["posts"][0]

    assert post["author"]["name"] == ANONYMOUS_NAME
    assert "Grace" not in str(post)


# --- posts ------------------------------------------------------------------

def patch_post_create(monkeypatch, job=None, author=HIDDEN):
    saved = AsyncMock()
    monkeypatch.setattr(community_service.post_repository, "create_post", saved)
    monkeypatch.setattr(community_service.job_repository, "get_job", AsyncMock(return_value=job))
    monkeypatch.setattr(community_service.user_repository, "get_users_by_ids",
                        AsyncMock(return_value={author["_id"]: author}))
    return saved


async def test_a_post_is_attributed_to_the_caller(monkeypatch):
    saved = patch_post_create(monkeypatch)

    out = await community_service.create_post("u3", "  shipped the ingest rewrite  ")

    doc = saved.call_args.args[0]
    assert doc["author_id"] == "u3"
    assert doc["text"] == "shipped the ingest rewrite", "text is trimmed"
    assert out["text"] == doc["text"]
    assert out["post_id"] == doc["_id"], "the view is rendered from the stored document"


async def test_a_post_may_reference_a_job(monkeypatch):
    saved = patch_post_create(monkeypatch, job={"_id": "job-1"})

    await community_service.create_post("u3", "we are hiring", job_id="job-1",
                                        company_name="Acme")

    doc = saved.call_args.args[0]
    assert doc["job_id"] == "job-1"
    assert doc["company_name"] == "Acme"


async def test_a_post_referencing_a_missing_job_is_refused(monkeypatch):
    saved = patch_post_create(monkeypatch, job=None)

    with pytest.raises(LookupError):
        await community_service.create_post("u3", "see this role", job_id="nope")
    saved.assert_not_called()


@pytest.mark.parametrize("text", ["", "   ", "\n\t "])
async def test_an_empty_post_is_refused(monkeypatch, text):
    saved = patch_post_create(monkeypatch)
    with pytest.raises(ValueError):
        await community_service.create_post("u3", text)
    saved.assert_not_called()


async def test_an_over_long_post_is_refused(monkeypatch):
    saved = patch_post_create(monkeypatch)
    with pytest.raises(ValueError):
        await community_service.create_post("u3", "x" * (community_service.MAX_POST_LENGTH + 1))
    saved.assert_not_called()


async def test_the_feed_is_paginated_and_capped(monkeypatch):
    listed = AsyncMock(return_value=[])
    monkeypatch.setattr(community_service.post_repository, "list_posts", listed)
    monkeypatch.setattr(community_service.post_repository, "count_posts", AsyncMock(return_value=0))
    monkeypatch.setattr(community_service.user_repository, "get_users_by_ids",
                        AsyncMock(return_value={}))

    out = await community_service.list_posts(limit=9999, skip=-5)

    assert listed.call_args.kwargs == {"limit": community_service.MAX_PAGE, "skip": 0}
    assert out["limit"] == community_service.MAX_PAGE and out["skip"] == 0


async def test_the_feed_resolves_authors_in_one_query(monkeypatch):
    """A page of posts must not cost one lookup per row."""
    rows = [{"_id": f"p{i}", "author_id": "u3", "text": "x", "created_at": NOW} for i in range(10)]
    monkeypatch.setattr(community_service.post_repository, "list_posts",
                        AsyncMock(return_value=rows))
    monkeypatch.setattr(community_service.post_repository, "count_posts",
                        AsyncMock(return_value=10))
    lookup = AsyncMock(return_value={"u3": HIDDEN})
    monkeypatch.setattr(community_service.user_repository, "get_users_by_ids", lookup)

    await community_service.list_posts()

    lookup.assert_called_once()
