"""
Only file allowed to query the users collection directly.
Services call these functions instead of touching Mongo themselves —
swap storage engines later by editing only this file.
"""
from typing import Optional

from app.db.mongodb import get_collection

collection = get_collection("users")


def _normalise_email(email: str) -> str:
    """Emails are matched case-insensitively, so they are stored folded."""
    return email.strip().lower()


async def create_user(doc: dict) -> None:
    await collection.insert_one(doc)


async def get_user_by_email(email: str) -> Optional[dict]:
    return await collection.find_one({"email": _normalise_email(email)})


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await collection.find_one({"_id": user_id})
