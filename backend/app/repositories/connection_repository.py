"""
Only file allowed to query the connections collection directly.

A connection is stored once, not twice. The pair is held in a sorted two-element
array, so `{"users": someone}` finds it from either side and the same two people
can only ever produce one document. Two directed rows would mean every read had
to union two queries and every write had to keep them in step.
"""
from datetime import datetime, timezone
from typing import List, Optional

from app.db.mongodb import get_collection

collection = get_collection("connections")


def pair(a: str, b: str) -> List[str]:
    """The canonical form of a connection between two people: sorted, so it is one value."""
    return sorted([a, b])


async def get_connection(a: str, b: str) -> Optional[dict]:
    return await collection.find_one({"users": pair(a, b)})


async def create_connection(connection_id: str, a: str, b: str) -> dict:
    doc = {
        "_id": connection_id,
        "users": pair(a, b),
        "created_at": datetime.now(timezone.utc),
    }
    await collection.insert_one(doc)
    return doc


async def list_for_user(user_id: str, limit: int = 200) -> List[dict]:
    """Every connection this user is part of, most recent first."""
    return await collection.find({"users": user_id}).sort("created_at", -1).to_list(limit)
