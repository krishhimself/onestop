"""
Business logic for the company-side quiz — the employer mirror of quiz_service.

The thesis cuts both ways. A candidate's claim is their repo, and the repo quiz
tests whether they understand it. A company's claim is its posting, and this tests
whether the posting describes a role the poster actually knows. Both are cheap to
generate and expensive to defend, which is the whole point.

It is the same engine: the same clock, the same paste ranking
(quiz_service.pick_suspect_answer), the same one adaptive follow-up before anything
is graded. Only the prompts differ — see integrations/gemini_client.py.

The gate: a job posting is created here, on a passing grade, from the draft stored
at generation time. No other code path creates a job. Two consequences worth being
explicit about:

  * The posting that gets created is the one the questions were generated from, so
    a company cannot defend an honest draft and redeem the pass against a different,
    rosier one.
  * A graded attempt is closed forever. It carries the job_id it produced (or None),
    so replaying the final call returns what already happened instead of minting a
    second posting.
"""
import uuid

from app.integrations import gemini_client
from app.repositories import company_quiz_repository
from app.schemas.quiz import TIME_LIMIT_SECONDS
from app.services import job_service
from app.services.quiz_service import pick_suspect_answer


class QuizClosed(Exception):
    """The attempt is not in a state where the requested step is meaningful."""


# The bar a posting must clear to go live. A module constant for the same reason as
# reputation_service.REVEAL_MIN_SCORE: the tests assert against this rather than a
# literal, so moving the bar cannot quietly leave the suite asserting the old one.
PASS_SCORE = 70.0

# Fields of the stored draft that describe the posting. Anything else on the attempt
# (ownership, answers, grading) is bookkeeping and must not reach the jobs collection.
DRAFT_FIELDS = ("company_name", "role_title", "description", "tech_stack", "trial_repo_url")


async def create_quiz(draft: dict, user_id: str) -> dict:
    """Generate the interrogation for a draft posting and hold the draft for later."""
    raw_questions = await gemini_client.generate_company_quiz_questions(draft)
    if not raw_questions:
        raise ValueError("no_questions")

    questions = [{"id": str(uuid.uuid4()), **q} for q in raw_questions]
    stored_draft = {k: draft.get(k) for k in DRAFT_FIELDS}

    quiz_id = str(uuid.uuid4())
    await company_quiz_repository.save_attempt(
        {
            "_id": quiz_id,
            "draft": stored_draft,
            "user_id": user_id,
            "questions": questions,
            "status": "generated",
        }
    )
    return {
        "quiz_id": quiz_id,
        "role_title": stored_draft.get("role_title") or "",
        "questions": questions,
        "time_limit_seconds": TIME_LIMIT_SECONDS,
    }


async def _load_owned_attempt(quiz_id: str, user_id: str) -> dict:
    """
    Fetch an attempt, but only for the account it belongs to.

    Mirrors quiz_service._load_owned_attempt: a quiz that exists but belongs to
    someone else raises the same LookupError as one that does not exist, so the
    endpoint answers 404 either way and cannot be used to discover which quiz ids
    are real. Kept here rather than shared because the two read different
    collections, and the ownership rule is short enough that a wrong-collection
    abstraction would cost more than the duplication.
    """
    attempt = await company_quiz_repository.get_attempt(quiz_id)
    if not attempt or attempt.get("user_id") != user_id:
        raise LookupError("quiz_not_found")
    return attempt


async def start_followup(quiz_id: str, answers: list[dict], user_id: str) -> dict:
    """Record the answers and open the follow-up round. Does not grade, does not post."""
    attempt = await _load_owned_attempt(quiz_id, user_id)
    if attempt.get("status") == "graded":
        # Re-opening a closed attempt would let a company answer again after seeing
        # how it scored.
        raise QuizClosed("already_graded")

    suspect = pick_suspect_answer(answers)
    if suspect is None:
        raise ValueError("no_answers")

    target = next(
        (q for q in attempt["questions"] if q["id"] == suspect.get("question_id")),
        attempt["questions"][0],
    )
    question_text = await gemini_client.generate_followup_question(
        target, suspect.get("answer") or "", framing=gemini_client.COMPANY_FRAMING
    )

    followup = {
        "id": str(uuid.uuid4()),
        "question": question_text,
        "targets_question_id": target["id"],
        "answer": None,
    }
    await company_quiz_repository.update_followup(quiz_id, answers, followup)

    return {
        "quiz_id": quiz_id,
        "followup": followup,
        "time_limit_seconds": TIME_LIMIT_SECONDS,
    }


def _result_payload(quiz_id: str, score: float, passed: bool, job_id, breakdown) -> dict:
    return {
        "quiz_id": quiz_id,
        "score": score,
        "pass_score": PASS_SCORE,
        "passed": passed,
        "job_id": job_id,
        "feedback": breakdown or [],
    }


async def grade_and_post(
    quiz_id: str, followup_answer: str, user_id: str, seconds_left: float | None = None
) -> dict:
    """
    Grade the whole round and, only on a pass, create the posting.

    Replaying this against an already-graded attempt returns the stored outcome
    rather than grading again, so a retried request cannot produce a second posting.
    """
    attempt = await _load_owned_attempt(quiz_id, user_id)

    if attempt.get("status") == "graded":
        stored = attempt.get("result") or {}
        return _result_payload(
            quiz_id,
            float(stored.get("overall_score") or 0),
            bool(attempt.get("passed")),
            attempt.get("job_id"),
            stored.get("breakdown"),
        )

    followup = dict(attempt.get("followup") or {})
    if not followup.get("question"):
        # The follow-up is the round that actually holds; grading without it would
        # let a company post by calling this endpoint directly and skipping the
        # interrogation entirely.
        raise QuizClosed("followup_not_started")

    followup["answer"] = followup_answer
    followup["seconds_left"] = seconds_left

    result = await gemini_client.grade_company_answers(
        attempt.get("draft") or {},
        attempt["questions"],
        attempt.get("answers") or [],
        followup=followup,
    )
    score = float(result.get("overall_score") or 0)
    passed = score >= PASS_SCORE

    # Posted before the attempt is closed out, so a failure here leaves the attempt
    # re-gradable rather than burning a quiz that never produced a posting. The cost
    # is a narrow window: if the write below fails after this insert, a retry can
    # post twice. Recording the outcome first would trade that for the opposite
    # failure, and losing an honest company's defended quiz is the worse one.
    job_id = None
    if passed:
        job_id = await job_service.post_job(
            {
                **(attempt.get("draft") or {}),
                "posted_by": user_id,
                "company_quiz_id": quiz_id,
            }
        )

    await company_quiz_repository.update_result(quiz_id, result, followup, passed, job_id)
    return _result_payload(quiz_id, score, passed, job_id, result.get("breakdown"))
