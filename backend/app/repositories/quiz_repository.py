"""
Only file allowed to query the quiz_attempts collection directly.
Services call these functions instead of touching Mongo themselves —
swap storage engines later by editing only this file.
"""
from typing import Optional

from app.db.mongodb import get_collection

collection = get_collection("quiz_attempts")


async def save_attempt(doc: dict) -> None:
    await collection.insert_one(doc)


async def get_attempt(quiz_id: str) -> Optional[dict]:
    return await collection.find_one({"_id": quiz_id})


async def update_followup(quiz_id: str, answers: list[dict], followup: dict) -> None:
    await collection.update_one(
        {"_id": quiz_id},
        {"$set": {"status": "awaiting_followup", "answers": answers, "followup": followup}},
    )


async def update_result(quiz_id: str, result: dict, followup: dict | None = None) -> None:
    changes = {"status": "graded", "result": result}
    if followup is not None:
        changes["followup"] = followup
    await collection.update_one({"_id": quiz_id}, {"$set": changes})


async def update_attempt(quiz_id: str, changes: dict) -> None:
    await collection.update_one({"_id": quiz_id}, {"$set": changes})


async def update_bughunt_result(quiz_id: str, findings: list[dict], result: dict) -> None:
    await collection.update_one(
        {"_id": quiz_id},
        {"$set": {"status": "graded", "findings": findings, "result": result}},
    )



async def has_graded_attempt_scoring_at_least(user_id: str, minimum: float) -> bool:
    """
    True if this user owns at least one graded attempt at or above `minimum`.

    Only `status: "graded"` candidate quizzes count: an attempt still awaiting its follow-up has no
    defended score, and reading `result` off one would credit a score the candidate
    has not yet had to stand behind.

    Projected down to `_id` because the caller only needs the yes/no — there is no
    reason to pull whole attempt documents across the wire to answer it.
    """
    match = await collection.find_one(
        {
            "user_id": user_id,
            "status": "graded",
            "type": {"$ne": "day1"},
            "result.overall_score": {"$gte": minimum},
        },
        {"_id": 1},
    )
    return match is not None


async def graded_scores_for_user(user_id: str, limit: int = 500) -> list[float]:
    """
    Every defended candidate repo comprehension score this user holds, for the reputation average.

    Day-1 readiness quizzes are excluded (type: "day1") so they are never blended into
    the comprehension score.
    """
    docs = await collection.find(
        {"user_id": user_id, "status": "graded", "type": {"$ne": "day1"}},
        {"result.overall_score": 1},
    ).to_list(limit)

    scores = []
    for doc in docs:
        raw = (doc.get("result") or {}).get("overall_score")
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            scores.append(float(raw))
    return scores


async def graded_day1_scores_for_user(user_id: str, limit: int = 500) -> list[float]:
    """
    Every defended Day-1 readiness quiz score this user holds, for the Day-1 readiness component.
    """
    docs = await collection.find(
        {"user_id": user_id, "status": "graded", "type": "day1"},
        {"result.overall_score": 1},
    ).to_list(limit)

    scores = []
    for doc in docs:
        raw = (doc.get("result") or {}).get("overall_score")
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            scores.append(float(raw))
    return scores
