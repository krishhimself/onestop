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
