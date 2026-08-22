"""
Business logic for the repo-quiz feature. This is the core mechanism
of the whole platform — everything else (score tab, reputation, company
quiz) eventually calls into or reuses this.
"""
import uuid

from app.integrations import gemini_client, github_client
from app.repositories import quiz_repository
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


def pick_suspect_answer(answers: list[dict], time_limit: int = TIME_LIMIT_SECONDS) -> dict | None:
    """
    Choose the answer least likely to have been typed by its author.

    Typing pace is the signal. A long, polished answer committed with most of the
    clock still unspent was not composed in the box — nobody writes 900 considered
    characters in twelve seconds. Weighting rate by length keeps a fast one-liner
    from outranking a suspiciously fast essay.

    Falls back to the first non-empty answer, then to the first answer, so the
    follow-up round always happens even with no timing data at all.
    """
    answered = [a for a in answers if (a.get("answer") or "").strip()]
    if not answered:
        return answers[0] if answers else None

    timed = [a for a in answered if a.get("seconds_left") is not None]
    if not timed:
        return answered[0]

    def suspicion(a: dict) -> float:
        length = len((a.get("answer") or "").strip())
        elapsed = max(time_limit - float(a["seconds_left"]), 1.0)
        return (length / elapsed) * length  # fast AND long

    return max(timed, key=suspicion)


async def start_followup(quiz_id: str, answers: list[dict]) -> dict:
    """
    Record the answers and open the follow-up round.

    Deliberately does not grade yet — grading before the follow-up would let a
    candidate bank a score and abandon the round they cannot pass.
    """
    attempt = await quiz_repository.get_attempt(quiz_id)
    if not attempt:
        raise LookupError("quiz_not_found")

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


async def grade_quiz(quiz_id: str, followup_answer: str, seconds_left: float | None = None) -> dict:
    """Final grading — original answers plus the follow-up defence."""
    attempt = await quiz_repository.get_attempt(quiz_id)
    if not attempt:
        raise LookupError("quiz_not_found")

    followup = dict(attempt.get("followup") or {})
    followup["answer"] = followup_answer
    followup["seconds_left"] = seconds_left

    result = await gemini_client.grade_answers(
        attempt["questions"], attempt.get("answers") or [], followup=followup
    )
    await quiz_repository.update_result(quiz_id, result, followup)
    return result
