"""
The unified reputation score.

The property under test is not the arithmetic - it is that the components stay
visible and that an account with no history is an ordinary answer rather than an
error. A single blended number would be read as a measure of engineering ability,
which it is not.
"""
from unittest.mock import AsyncMock

import pytest

from app.services import reputation_service
from app.services.reputation_service import (
    COMPREHENSION_WEIGHT,
    ROUNDS_FOR_FULL_CREDIT,
    ROUNDS_WEIGHT,
    ROUND_STATUSES,
)


def patch_history(monkeypatch, scores, rounds=0, user={"_id": "u1"}):
    monkeypatch.setattr(reputation_service.user_repository, "get_user_by_id",
                        AsyncMock(return_value=user))
    monkeypatch.setattr(reputation_service.quiz_repository, "graded_scores_for_user",
                        AsyncMock(return_value=scores))
    counted = AsyncMock(return_value=rounds)
    monkeypatch.setattr(reputation_service.job_repository,
                        "count_applications_with_status", counted)
    return counted


# --- the two scenarios that have to hold ------------------------------------

async def test_two_graded_quizzes_and_an_accepted_application(monkeypatch):
    """The worked example: the breakdown has to explain the total."""
    patch_history(monkeypatch, scores=[88.0, 72.0], rounds=1)

    out = await reputation_service.compute_reputation("u1")

    assert out["comprehension"] == 80, "mean of 88 and 72"
    assert out["quiz_count"] == 2
    assert out["rounds_reached"] == 1
    # 80 * 0.75 + (1/4 * 100) * 0.25 = 60 + 6.25
    assert out["overall"] == 66
    assert set(out) == {"overall", "comprehension", "quiz_count", "rounds_reached"}


async def test_a_brand_new_user_scores_zero_without_erroring(monkeypatch):
    patch_history(monkeypatch, scores=[], rounds=0)

    out = await reputation_service.compute_reputation("u1")

    assert out == {"overall": 0, "comprehension": 0, "quiz_count": 0, "rounds_reached": 0}


# --- components -------------------------------------------------------------

async def test_the_average_is_over_defended_scores_only(monkeypatch):
    """One 100 does not make a reputation; the count is what shows that."""
    patch_history(monkeypatch, scores=[100.0], rounds=0)
    one = await reputation_service.compute_reputation("u1")

    patch_history(monkeypatch, scores=[100.0] * 6, rounds=0)
    six = await reputation_service.compute_reputation("u1")

    assert one["comprehension"] == six["comprehension"] == 100
    assert one["overall"] == six["overall"], "the average alone cannot separate them"
    assert (one["quiz_count"], six["quiz_count"]) == (1, 6), "the count must"


async def test_rounds_alone_produce_a_score(monkeypatch):
    """Outside corroboration counts even with no quiz taken yet."""
    patch_history(monkeypatch, scores=[], rounds=ROUNDS_FOR_FULL_CREDIT)

    out = await reputation_service.compute_reputation("u1")

    assert out["comprehension"] == 0
    assert out["overall"] == round(100 * ROUNDS_WEIGHT)


async def test_rounds_saturate_so_volume_is_not_rewarded(monkeypatch):
    patch_history(monkeypatch, scores=[80.0], rounds=ROUNDS_FOR_FULL_CREDIT)
    at_ceiling = await reputation_service.compute_reputation("u1")

    patch_history(monkeypatch, scores=[80.0], rounds=ROUNDS_FOR_FULL_CREDIT * 10)
    far_past = await reputation_service.compute_reputation("u1")

    assert at_ceiling["overall"] == far_past["overall"]
    assert far_past["rounds_reached"] == ROUNDS_FOR_FULL_CREDIT * 10, "still reported"


async def test_a_perfect_history_is_a_hundred(monkeypatch):
    patch_history(monkeypatch, scores=[100.0], rounds=ROUNDS_FOR_FULL_CREDIT)
    assert (await reputation_service.compute_reputation("u1"))["overall"] == 100


async def test_comprehension_carries_most_of_the_weight(monkeypatch):
    """The platform verifies comprehension; rounds are corroboration, not the point."""
    assert COMPREHENSION_WEIGHT > ROUNDS_WEIGHT
    assert COMPREHENSION_WEIGHT + ROUNDS_WEIGHT == 1.0

    patch_history(monkeypatch, scores=[100.0], rounds=0)
    quizzes_only = await reputation_service.compute_reputation("u1")
    patch_history(monkeypatch, scores=[], rounds=99)
    rounds_only = await reputation_service.compute_reputation("u1")

    assert quizzes_only["overall"] > rounds_only["overall"]


# --- which applications count -----------------------------------------------

async def test_applied_is_the_only_status_that_does_not_count(monkeypatch):
    """Submitting an application is not an achievement; being looked at is."""
    counted = patch_history(monkeypatch, scores=[], rounds=0)
    await reputation_service.compute_reputation("u1")

    user_id, statuses = counted.call_args.args
    assert user_id == "u1"
    assert "applied" not in statuses
    assert set(statuses) == {"reviewed", "rejected", "accepted"} == set(ROUND_STATUSES)


# --- unknown user -----------------------------------------------------------

async def test_an_unknown_user_raises_rather_than_scoring_zero(monkeypatch):
    """Zeros mean a new account. A missing account has to be distinguishable."""
    patch_history(monkeypatch, scores=[], rounds=0, user=None)
    with pytest.raises(LookupError):
        await reputation_service.compute_reputation("nobody")


async def test_an_unknown_user_costs_no_further_queries(monkeypatch):
    monkeypatch.setattr(reputation_service.user_repository, "get_user_by_id",
                        AsyncMock(return_value=None))
    scores = AsyncMock()
    monkeypatch.setattr(reputation_service.quiz_repository, "graded_scores_for_user", scores)

    with pytest.raises(LookupError):
        await reputation_service.compute_reputation("nobody")
    scores.assert_not_called()
