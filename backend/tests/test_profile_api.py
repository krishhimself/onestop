"""
The anonymous-first funnel.

The promise the product makes is that a candidate is a pseudonym until their work
earns the introduction. That promise is only worth something if the identifying
fields are absent from the response — not merely unrendered — so these tests
assert on the payload, and on the fact that the reveal is written down once it
happens.
"""
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositories import user_repository
from app.services import reputation_service
from app.services.reputation_service import ANONYMOUS_NAME, REVEAL_MIN_SCORE

client = TestClient(app)

USER = {
    "_id": "user-1",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "hashed_password": "irrelevant",
    "role": "candidate",
    "revealed": False,
}


@pytest.fixture
def store(monkeypatch):
    """
    Stands in for Mongo: one user, and a switch for whether they hold a passing
    attempt. `revealed` writes land back on the same dict, so a test can assert
    the latch was persisted rather than only reported.
    """
    user = dict(USER)

    async def get_user_by_id(user_id):
        return dict(user) if user_id == user["_id"] else None

    async def mark_revealed(user_id):
        assert user_id == user["_id"]
        user["revealed"] = True

    monkeypatch.setattr(reputation_service.user_repository, "get_user_by_id", get_user_by_id)
    monkeypatch.setattr(reputation_service.user_repository, "mark_revealed", mark_revealed)
    monkeypatch.setattr(
        reputation_service.quiz_repository,
        "has_graded_attempt_scoring_at_least",
        AsyncMock(return_value=False),
    )
    return user


@pytest.fixture
def passing(monkeypatch):
    """Make the threshold query answer yes, as it would for a 70+ graded attempt."""
    query = AsyncMock(return_value=True)
    monkeypatch.setattr(
        reputation_service.quiz_repository, "has_graded_attempt_scoring_at_least", query
    )
    return query


# --- anonymous by default --------------------------------------------------

def test_a_fresh_users_profile_is_anonymous(store):
    resp = client.get("/api/v1/profile/user-1")

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == ANONYMOUS_NAME
    assert body["email"] is None
    assert body["revealed"] is False


def test_an_anonymous_profile_carries_no_identifying_string_at_all(store):
    """
    The point of stripping in the service: if the real name or address appeared
    anywhere in the payload, the pseudonym would be a UI convention rather than a
    guarantee, and the network tab would undo it.
    """
    raw = client.get("/api/v1/profile/user-1").text

    assert "Ada Lovelace" not in raw
    assert "ada@example.com" not in raw


def test_an_anonymous_profile_still_shows_the_role(store):
    """The funnel hides who someone is, not what they are here to do."""
    assert client.get("/api/v1/profile/user-1").json()["role"] == "candidate"


def test_an_unknown_user_is_404(store):
    assert client.get("/api/v1/profile/nobody").status_code == 404


# --- reveal ----------------------------------------------------------------

def test_a_passing_score_reveals_the_candidate(store, passing):
    resp = client.get("/api/v1/profile/user-1")

    assert resp.status_code == 200
    body = resp.json()
    assert body["revealed"] is True
    assert body["name"] == "Ada Lovelace"
    assert body["email"] == "ada@example.com"


def test_the_threshold_is_asked_for_the_documented_score(store, passing):
    client.get("/api/v1/profile/user-1")
    assert passing.call_args.args == ("user-1", REVEAL_MIN_SCORE)


def test_the_reveal_is_persisted_not_just_returned(store, passing):
    """Otherwise every viewer would re-run the threshold query for a settled fact."""
    client.get("/api/v1/profile/user-1")
    assert store["revealed"] is True


def test_an_already_revealed_user_is_not_re_evaluated(store):
    """
    A latch: once revealed, the threshold is no longer consulted, so raising the
    bar later cannot retract an identity employers have already seen.
    """
    store["revealed"] = True
    resp = client.get("/api/v1/profile/user-1")

    assert resp.json()["name"] == "Ada Lovelace"
    reputation_service.quiz_repository.has_graded_attempt_scoring_at_least.assert_not_called()


def test_a_user_below_the_threshold_stays_anonymous(store):
    resp = client.get("/api/v1/profile/user-1")

    assert resp.json()["revealed"] is False
    assert store["revealed"] is False, "a failed check must not latch the account open"


# --- the threshold itself --------------------------------------------------

async def test_the_threshold_asks_only_for_defended_scores(monkeypatch):
    """
    Grading happens after the follow-up, so `status: graded` is what separates a
    score the candidate defended from one they merely started.
    """
    captured = {}

    async def fake_find_one(query, projection=None):
        captured["query"] = query
        return None

    monkeypatch.setattr(reputation_service.quiz_repository, "collection", type(
        "C", (), {"find_one": staticmethod(fake_find_one)}
    ))

    assert await reputation_service.meets_reveal_threshold("user-1") is False
    assert captured["query"]["user_id"] == "user-1"
    assert captured["query"]["status"] == "graded"
    assert captured["query"]["result.overall_score"] == {"$gte": REVEAL_MIN_SCORE}


# --- the users collection --------------------------------------------------

class FakeCollection:
    """Records what the repository asked Mongo to do."""

    def __init__(self, doc=None):
        self.doc = doc
        self.updates = []

    async def find_one(self, query, projection=None):
        return dict(self.doc) if self.doc else None

    async def update_one(self, query, changes):
        self.updates.append((query, changes))

    async def insert_one(self, doc):
        self.doc = doc


async def test_an_account_predating_the_field_reads_as_anonymous(monkeypatch):
    """
    Documents are not migrated, so the absent key must behave as the safe value.
    If this ever read as truthy, every legacy account would be revealed at once.
    """
    legacy = {"_id": "old-user", "email": "old@example.com", "role": "candidate"}
    monkeypatch.setattr(user_repository, "collection", FakeCollection(legacy))

    user = await user_repository.get_user_by_id("old-user")
    assert user["revealed"] is False
    assert user["name"] is None


async def test_a_new_account_is_written_with_the_field(monkeypatch):
    fake = FakeCollection()
    monkeypatch.setattr(user_repository, "collection", fake)

    await user_repository.create_user({"_id": "u", "email": "a@b.com", "role": "candidate"})
    assert fake.doc["revealed"] is False


async def test_mark_revealed_sets_only_that_field(monkeypatch):
    fake = FakeCollection({"_id": "u"})
    monkeypatch.setattr(user_repository, "collection", fake)

    await user_repository.mark_revealed("u")
    assert fake.updates == [({"_id": "u"}, {"$set": {"revealed": True}})]
