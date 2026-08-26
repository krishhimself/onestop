"""
Business logic for the repo-quiz feature. This is the core mechanism
of the whole platform — everything else (score tab, reputation, company
quiz) eventually calls into or reuses this.
"""
import uuid

from app.integrations import gemini_client, github_client
from app.repositories import job_repository, quiz_repository
from app.schemas.quiz import TIME_LIMIT_SECONDS


async def create_quiz(repo_url: str, user_id: str | None) -> dict:
    files = await github_client.fetch_repo_files(repo_url)
    if not files:
        raise ValueError("no_source_files")

    raw_questions, complexity = await gemini_client.generate_quiz_questions(files)
    questions = [{"id": str(uuid.uuid4()), **q} for q in raw_questions]

    quiz_id = str(uuid.uuid4())
    await quiz_repository.save_attempt(
        {
            "_id": quiz_id,
            "type": "candidate",
            "repo_url": repo_url,
            "user_id": user_id,
            "questions": questions,
            "complexity": complexity,
            "status": "generated",
        }
    )
    return {
        "quiz_id": quiz_id,
        "repo_url": repo_url,
        "questions": questions,
        "complexity": complexity,
        "time_limit_seconds": TIME_LIMIT_SECONDS,
    }


async def create_day1_quiz(job_id: str, user_id: str | None = None) -> dict:
    """
    Generate a Day-1 Readiness quiz from the job's attached trial repo.

    Tests how quickly the candidate orients in an unfamiliar codebase they have
    never seen before.
    """
    job = await job_repository.get_job(job_id)
    if not job:
        raise LookupError("job_not_found")

    trial_repo_url = job.get("trial_repo_url")
    if not trial_repo_url:
        raise ValueError("no_trial_repo")

    files = await github_client.fetch_repo_files(trial_repo_url)
    if not files:
        raise ValueError("no_source_files")

    raw_questions = await gemini_client.generate_day1_questions(files)
    questions = [{"id": str(uuid.uuid4()), **q} for q in raw_questions]

    quiz_id = str(uuid.uuid4())
    await quiz_repository.save_attempt(
        {
            "_id": quiz_id,
            "type": "day1",
            "job_id": job_id,
            "repo_url": trial_repo_url,
            "user_id": user_id,
            "questions": questions,
            "status": "generated",
        }
    )
    return {
        "quiz_id": quiz_id,
        "job_id": job_id,
        "repo_url": trial_repo_url,
        "questions": questions,
        "time_limit_seconds": TIME_LIMIT_SECONDS,
    }


def pick_suspect_answer(answers: list[dict], time_limit: int = TIME_LIMIT_SECONDS) -> dict | None:
    """
    Choose the answer least likely to have been typed by its author.

    A recorded paste wins outright: the client saw a whole paragraph arrive in one
    input event, which is evidence rather than inference. Ties among flagged answers
    go to the largest single injection.

    Otherwise typing pace is the signal. A long, polished answer committed with most
    of the clock still unspent was not composed in the box — nobody writes 900
    considered characters in twelve seconds. Weighting rate by length keeps a fast
    one-liner from outranking a suspiciously fast essay.

    Falls back to the first non-empty answer, then to the first answer, so the
    follow-up round always happens even with no timing data at all.
    """
    answered = [a for a in answers if (a.get("answer") or "").strip()]
    if not answered:
        return answers[0] if answers else None

    # A recorded paste outranks every timing heuristic — it is direct evidence rather
    # than an inference. Among several, push on the largest single injection.
    pasted = [a for a in answered if a.get("flagged_paste")]
    if pasted:
        return max(pasted, key=lambda a: a.get("paste_delta") or 0)

    timed = [a for a in answered if a.get("seconds_left") is not None]
    if not timed:
        return answered[0]

    def suspicion(a: dict) -> float:
        length = len((a.get("answer") or "").strip())
        elapsed = max(time_limit - float(a["seconds_left"]), 1.0)
        return (length / elapsed) * length  # fast AND long

    return max(timed, key=suspicion)


async def _load_owned_attempt(quiz_id: str, user_id: str) -> dict:
    """
    Fetch an attempt, but only for the person it belongs to.

    Ownership is enforced here rather than in each caller so it cannot be
    forgotten by one of them. A quiz that exists but belongs to someone else
    raises the same LookupError as one that does not exist, so the endpoint
    answers 404 either way and cannot be used to discover which quiz ids are real.

    Attempts created before authentication existed have no owner and are therefore
    unreachable, which is correct: an unattributed attempt proves nothing about
    anyone.
    """
    attempt = await quiz_repository.get_attempt(quiz_id)
    if not attempt or attempt.get("user_id") != user_id:
        raise LookupError("quiz_not_found")
    return attempt


async def start_followup(quiz_id: str, answers: list[dict], user_id: str) -> dict:
    """
    Record the answers and open the follow-up round.

    Deliberately does not grade yet — grading before the follow-up would let a
    candidate bank a score and abandon the round they cannot pass.
    """
    attempt = await _load_owned_attempt(quiz_id, user_id)

    suspect = pick_suspect_answer(answers)
    if suspect is None:
        raise ValueError("no_answers")

    target = next(
        (q for q in attempt["questions"] if q["id"] == suspect.get("question_id")),
        attempt["questions"][0],
    )
    question_text = await gemini_client.generate_followup_question(
        target, suspect.get("answer") or ""
    )

    followup = {
        "id": str(uuid.uuid4()),
        "question": question_text,
        "targets_question_id": target["id"],
        "answer": None,
    }
    await quiz_repository.update_followup(quiz_id, answers, followup)

    return {
        "quiz_id": quiz_id,
        "followup": followup,
        "time_limit_seconds": TIME_LIMIT_SECONDS,
    }


async def grade_quiz(
    quiz_id: str, followup_answer: str, user_id: str, seconds_left: float | None = None
) -> dict:
    """Final grading — original answers plus the follow-up defence."""
    attempt = await _load_owned_attempt(quiz_id, user_id)

    followup = dict(attempt.get("followup") or {})
    followup["answer"] = followup_answer
    followup["seconds_left"] = seconds_left

    result = await gemini_client.grade_answers(
        attempt["questions"], attempt.get("answers") or [], followup=followup
    )
    await quiz_repository.update_result(quiz_id, result, followup)
    return result
