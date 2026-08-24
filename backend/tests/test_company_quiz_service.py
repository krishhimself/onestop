"""
The company-side gate.

Everything here is about one property: a job posting exists only as the output of
a quiz its owner defended, and it is the posting that was defended. The scoring
itself is the model's business; what these tests hold down is that no other path
reaches the jobs collection.
"""
from unittest.mock import AsyncMock

import pytest

from app.services import company_quiz_service
from app.services.company_quiz_service import PASS_SCORE, QuizClosed


def patch_generation(monkeypatch, questions=None):
    gen = AsyncMock(return_value=questions if questions is not None else [
        {"question": "What does this hire do in week one?", "category": "role"},
    ])
    monkeypatch.setattr(company_quiz_service.gemini_client, "generate_company_quiz_questions", gen)
    saved = AsyncMock()
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "save_attempt", saved)
    return gen, saved


def patch_grading(monkeypatch, attempt, score, breakdown=None):
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=attempt))
    monkeypatch.setattr(company_quiz_service.gemini_client, "grade_company_answers",
                        AsyncMock(return_value={"overall_score": score,
                                                "breakdown": breakdown or []}))
    recorded = AsyncMock()
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "update_result", recorded)
    posted = AsyncMock(return_value="job-1")
    monkeypatch.setattr(company_quiz_service.job_service, "post_job", posted)
    return posted, recorded


# --- generate --------------------------------------------------------------

async def test_create_quiz_assigns_ids_and_stores_the_draft(monkeypatch, draft):
    _, saved = patch_generation(monkeypatch)

    out = await company_quiz_service.create_quiz(draft, "e1")

    assert out["questions"][0]["id"], "questions must be given ids"
    assert out["time_limit_seconds"] == 75
    doc = saved.call_args.args[0]
    assert doc["draft"] == draft
    assert doc["user_id"] == "e1"
    assert doc["status"] == "generated"


async def test_create_quiz_stores_only_posting_fields(monkeypatch, draft):
    """A caller cannot smuggle extra keys into the jobs document via the draft."""
    _, saved = patch_generation(monkeypatch)

    await company_quiz_service.create_quiz(
        {**draft, "posted_by": "someone-else", "verified": True}, "e1"
    )

    assert set(saved.call_args.args[0]["draft"]) == set(company_quiz_service.DRAFT_FIELDS)


async def test_create_quiz_rejects_a_posting_that_yields_no_questions(monkeypatch, draft):
    patch_generation(monkeypatch, questions=[])
    with pytest.raises(ValueError):
        await company_quiz_service.create_quiz(draft, "e1")


# --- follow-up round -------------------------------------------------------

async def test_start_followup_targets_the_flagged_answer(monkeypatch, company_attempt):
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=company_attempt))
    gen = AsyncMock(return_value="Who is on call for ingest today?")
    monkeypatch.setattr(company_quiz_service.gemini_client, "generate_followup_question", gen)
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "update_followup", AsyncMock())

    out = await company_quiz_service.start_followup("cquiz-1", company_attempt["answers"], "e1")

    assert out["followup"]["targets_question_id"] == "cq2"
    assert gen.call_args.args[1] == company_attempt["answers"][1]["answer"]


async def test_followup_is_asked_in_the_company_framing(monkeypatch, company_attempt):
    """Same generator as the candidate side - it must not address them as a developer."""
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=company_attempt))
    gen = AsyncMock(return_value="q?")
    monkeypatch.setattr(company_quiz_service.gemini_client, "generate_followup_question", gen)
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "update_followup", AsyncMock())

    await company_quiz_service.start_followup("cquiz-1", company_attempt["answers"], "e1")

    assert gen.call_args.kwargs["framing"] is company_quiz_service.gemini_client.COMPANY_FRAMING


async def test_start_followup_does_not_grade_or_post(monkeypatch, company_attempt):
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=company_attempt))
    monkeypatch.setattr(company_quiz_service.gemini_client, "generate_followup_question",
                        AsyncMock(return_value="q?"))
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "update_followup", AsyncMock())
    posted = AsyncMock()
    monkeypatch.setattr(company_quiz_service.job_service, "post_job", posted)
    graded = AsyncMock()
    monkeypatch.setattr(company_quiz_service.gemini_client, "grade_company_answers", graded)

    out = await company_quiz_service.start_followup("cquiz-1", company_attempt["answers"], "e1")

    posted.assert_not_called()
    graded.assert_not_called()
    assert "score" not in out


async def test_start_followup_refuses_a_graded_attempt(monkeypatch, company_attempt):
    """Re-opening a closed attempt would mean answering again after seeing the score."""
    company_attempt["status"] = "graded"
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=company_attempt))
    with pytest.raises(QuizClosed):
        await company_quiz_service.start_followup("cquiz-1", company_attempt["answers"], "e1")


# --- the gate --------------------------------------------------------------

async def test_passing_publishes_the_posting_that_was_defended(monkeypatch, company_attempt, draft):
    posted, recorded = patch_grading(monkeypatch, company_attempt, PASS_SCORE + 12)

    out = await company_quiz_service.grade_and_post("cquiz-1", "our defence", "e1", 8.0)

    assert out["passed"] is True
    assert out["job_id"] == "job-1"
    assert out["pass_score"] == PASS_SCORE
    sent = posted.call_args.args[0]
    for field in draft:
        assert sent[field] == draft[field], "the posting must be the stored draft"
    assert sent["posted_by"] == "e1"
    assert sent["company_quiz_id"] == "cquiz-1"
    assert recorded.call_args.args[4] == "job-1"


async def test_failing_publishes_nothing(monkeypatch, company_attempt):
    posted, recorded = patch_grading(monkeypatch, company_attempt, PASS_SCORE - 1)

    out = await company_quiz_service.grade_and_post("cquiz-1", "vague defence", "e1")

    assert out["passed"] is False
    assert out["job_id"] is None
    posted.assert_not_called()
    assert recorded.call_args.args[3] is False


async def test_exactly_the_pass_score_passes(monkeypatch, company_attempt):
    """The bar is inclusive - asserted against the constant, not a literal."""
    posted, _ = patch_grading(monkeypatch, company_attempt, PASS_SCORE)

    out = await company_quiz_service.grade_and_post("cquiz-1", "defence", "e1")

    assert out["passed"] is True
    posted.assert_called_once()


async def test_the_defence_and_the_posting_both_reach_the_grader(monkeypatch, company_attempt):
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=company_attempt))
    grade = AsyncMock(return_value={"overall_score": 81, "breakdown": []})
    monkeypatch.setattr(company_quiz_service.gemini_client, "grade_company_answers", grade)
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "update_result", AsyncMock())
    monkeypatch.setattr(company_quiz_service.job_service, "post_job", AsyncMock(return_value="job-1"))

    await company_quiz_service.grade_and_post("cquiz-1", "on-call is me", "e1", 9.0)

    sent = grade.call_args.kwargs["followup"]
    assert sent["answer"] == "on-call is me"
    assert sent["targets_question_id"] == "cq2"
    # The posting is graded alongside the answers, so a contradiction between the two
    # is visible to the grader rather than invisible.
    assert grade.call_args.args[0] == company_attempt["draft"]


async def test_grading_requires_the_followup_round(monkeypatch, company_attempt):
    """Calling the API directly must not let a company skip the interrogation."""
    company_attempt["status"] = "generated"
    company_attempt["followup"] = None
    posted, _ = patch_grading(monkeypatch, company_attempt, 95)

    with pytest.raises(QuizClosed):
        await company_quiz_service.grade_and_post("cquiz-1", "", "e1")
    posted.assert_not_called()


async def test_a_graded_attempt_cannot_mint_a_second_posting(monkeypatch, company_attempt):
    """A retried request returns what already happened rather than posting again."""
    company_attempt.update({
        "status": "graded",
        "passed": True,
        "job_id": "job-1",
        "result": {"overall_score": 88.0, "breakdown": [{"question": "q", "score": 9, "note": "n"}]},
    })
    posted, recorded = patch_grading(monkeypatch, company_attempt, 100)

    out = await company_quiz_service.grade_and_post("cquiz-1", "again", "e1")

    assert out == {"quiz_id": "cquiz-1", "score": 88.0, "pass_score": PASS_SCORE,
                   "passed": True, "job_id": "job-1",
                   "feedback": [{"question": "q", "score": 9, "note": "n"}]}
    posted.assert_not_called()
    recorded.assert_not_called()


async def test_a_failed_attempt_cannot_be_regraded_into_a_pass(monkeypatch, company_attempt):
    company_attempt.update({"status": "graded", "passed": False, "job_id": None,
                            "result": {"overall_score": 31.0, "breakdown": []}})
    posted, _ = patch_grading(monkeypatch, company_attempt, 99)

    out = await company_quiz_service.grade_and_post("cquiz-1", "better defence", "e1")

    assert out["passed"] is False and out["job_id"] is None
    posted.assert_not_called()


# --- ownership -------------------------------------------------------------

async def test_another_account_cannot_grade_or_post(monkeypatch, company_attempt):
    posted, _ = patch_grading(monkeypatch, company_attempt, 95)

    with pytest.raises(LookupError):
        await company_quiz_service.grade_and_post("cquiz-1", "defence", "another-employer")
    posted.assert_not_called()


async def test_a_missing_quiz_and_someone_elses_are_indistinguishable(monkeypatch, company_attempt):
    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=None))
    with pytest.raises(LookupError) as missing:
        await company_quiz_service.grade_and_post("nope", "d", "e1")

    monkeypatch.setattr(company_quiz_service.company_quiz_repository, "get_attempt",
                        AsyncMock(return_value=company_attempt))
    with pytest.raises(LookupError) as foreign:
        await company_quiz_service.grade_and_post("cquiz-1", "d", "another-employer")

    assert str(missing.value) == str(foreign.value)
