"""
Only file allowed to query the users collection directly.
Services call these functions instead of touching Mongo themselves —
swap storage engines later by editing only this file.
"""
from typing import Optional

from app.db.mongodb import get_collection

collection = get_collection("users")

# Fields every user document is expected to carry, and what a document written
# before the field existed should be read as. Applied on write (so new documents
# are complete) and on read (so old ones behave as if they were).
DEFAULTS = {
    "name": None,
    "revealed": False,
}


def _normalise_email(email: str) -> str:
    """Emails are matched case-insensitively, so they are stored folded."""
    return email.strip().lower()


def _with_defaults(doc: Optional[dict]) -> Optional[dict]:
    """Backfills absent fields in memory so callers never branch on a missing key."""
    if doc is None:
        return None
    return {**DEFAULTS, **doc}


async def create_user(doc: dict) -> None:
    await collection.insert_one({**DEFAULTS, **doc})


async def get_user_by_email(email: str) -> Optional[dict]:
    return _with_defaults(await collection.find_one({"email": _normalise_email(email)}))


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return _with_defaults(await collection.find_one({"_id": user_id}))


async def mark_revealed(user_id: str) -> None:
    """
    Latch the account as revealed. One way on purpose: a candidate who has cleared
    the threshold and been seen by employers cannot be put back behind the
    pseudonym, so there is no un-reveal counterpart to this.
    """
    await collection.update_one({"_id": user_id}, {"$set": {"revealed": True}})
