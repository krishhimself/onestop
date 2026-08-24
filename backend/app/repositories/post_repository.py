"""
Only file allowed to query the posts collection directly.

Append-only: posts are created and listed, never edited or deleted. There is no
comment, like, or reaction storage here on purpose — see models/community.py.
"""
from typing import List

from app.db.mongodb import get_collection

collection = get_collection("posts")


async def create_post(doc: dict) -> None:
    await collection.insert_one(doc)


async def list_posts(limit: int = 20, skip: int = 0) -> List[dict]:
    """
    Most recent first.

    Offset paging rather than a cursor. Posts are append-only, so the only
    anomaly is a post arriving mid-scroll and shifting a page boundary by one —
    cheap to live with at this size, and a `created_at` cursor is the fix when it
    stops being.
    """
    return await collection.find().sort("created_at", -1).skip(skip).to_list(limit)


async def count_posts() -> int:
    return await collection.count_documents({})
