"""
Only file allowed to query the company_quiz_attempts collection directly.

Deliberately a separate collection from quiz_attempts rather than a `kind` field
on the same one. quiz_repository.has_graded_attempt_scoring_at_least() matches any
graded attempt owned by a user, and it backs the candidate reveal threshold — a
company quiz sharing that collection would silently count as comprehension a
candidate never demonstrated. Separate collections make that impossible rather
than merely unlikely.
"""
from typing import Optional

from app.db.mongodb import get_collection

collection = get_collection("company_quiz_attempts")


async def save_attempt(doc: dict) -> None:
    await collection.insert_one(doc)


async def get_attempt(quiz_id: str) -> Optional[dict]:
    return await collection.find_one({"_id": quiz_id})


async def update_followup(quiz_id: str, answers: list[dict], followup: dict) -> None:
    await collection.update_one(
        {"_id": quiz_id},
        {"$set": {"status": "awaiting_followup", "answers": answers, "followup": followup}},
    )


async def update_result(
    quiz_id: str, result: dict, followup: dict, passed: bool, job_id: Optional[str]
) -> None:
    """
    Close the attempt out. `job_id` is the posting this quiz unlocked, or None when
    it did not clear the bar — recorded either way so a graded attempt can never be
    replayed to mint a second posting.
    """
    await collection.update_one(
        {"_id": quiz_id},
        {
            "$set": {
                "status": "graded",
                "result": result,
                "followup": followup,
                "passed": passed,
                "job_id": job_id,
            }
        },
    )
