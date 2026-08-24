"""
Business logic for the community surface: connections and the post feed.

Deliberately small. A connection is instant and mutual — there is no request, no
approval, no pending state — and a post is text that gets created and listed.
Comments, likes, reactions, threaded replies, DMs, notifications and media are
all out of scope; see models/community.py and the README roadmap.

The one thing that is not lightweight here is identity. Both surfaces list other
people, and an unrevealed candidate is a pseudonym everywhere or the funnel means
nothing — so every name that leaves this module goes through `_display`, which
reads the latched `revealed` flag and drops the name if it is False. This module
never evaluates the reveal threshold itself: that belongs to the profile read,
where flipping the latch is the documented behaviour. A candidate who has just
earned their reveal therefore appears here as themselves only after their profile
has been read, which is the safe direction to be wrong in.
"""
import uuid
from datetime import datetime, timezone

from app.repositories import (
    connection_repository,
    job_repository,
    post_repository,
    user_repository,
)
from app.services.reputation_service import ANONYMOUS_NAME

MAX_POST_LENGTH = 2000
DEFAULT_PAGE = 20
MAX_PAGE = 50


def _display(user_id: str, users: dict) -> dict:
    """One person as a list view may show them."""
    user = users.get(user_id) or {}
    revealed = bool(user.get("revealed"))
    return {
        "user_id": user_id,
        # Absent for an unrevealed account rather than blanked by the client, so
        # the name is not in the payload at all.
        "name": (user.get("name") or ANONYMOUS_NAME) if revealed else ANONYMOUS_NAME,
        "revealed": revealed,
    }


# --- connections -----------------------------------------------------------


async def connect(user_id: str, target_id: str) -> dict:
    """
    Connect two people, instantly and mutually.

    Idempotent: connecting to someone you are already connected to returns the
    existing connection rather than failing or creating a second one. With no
    approval flow there is no state for a repeat to advance, so an error would
    only punish a double-click.

    Raises ValueError for a self-connection and LookupError for an unknown target.
    """
    if user_id == target_id:
        raise ValueError("cannot_connect_to_self")
    if not await user_repository.get_user_by_id(target_id):
        raise LookupError("user_not_found")

    existing = await connection_repository.get_connection(user_id, target_id)
    if existing:
        return {"connection_id": existing["_id"], "user_id": user_id,
                "connected_to": target_id, "created": False}

    # A concurrent duplicate is possible between the check above and this write.
    # A unique index on `users` is the real fix; the consequence today is a second
    # document that reads identically, not a wrong answer.
    doc = await connection_repository.create_connection(
        str(uuid.uuid4()), user_id, target_id
    )
    return {"connection_id": doc["_id"], "user_id": user_id,
            "connected_to": target_id, "created": True}


async def list_connections(user_id: str) -> dict:
    """Who this user is connected to. Raises LookupError for an unknown user."""
    if not await user_repository.get_user_by_id(user_id):
        raise LookupError("user_not_found")

    rows = await connection_repository.list_for_user(user_id)
    # The stored pair holds both sides; the caller wants the other one.
    others = [next(u for u in row["users"] if u != user_id) for row in rows]
    users = await user_repository.get_users_by_ids(others)

    return {
        "user_id": user_id,
        "count": len(others),
        "connections": [
            {**_display(other, users), "connected_at": row.get("created_at")}
            for other, row in zip(others, rows)
        ],
    }


# --- posts -----------------------------------------------------------------


async def create_post(author_id: str, text: str, job_id=None, company_name=None) -> dict:
    """
    Add a post to the feed.

    The author comes from the caller's token, never from the body — the same rule
    the quiz uses, so a post cannot be attributed to somebody else. Raises
    ValueError for empty or over-long text, LookupError for a job reference that
    does not exist.
    """
    body = (text or "").strip()
    if not body or len(body) > MAX_POST_LENGTH:
        raise ValueError("invalid_text")

    if job_id and not await job_repository.get_job(job_id):
        raise LookupError("job_not_found")

    doc = {
        "_id": str(uuid.uuid4()),
        "author_id": author_id,
        "text": body,
        "job_id": job_id,
        "company_name": (company_name or "").strip() or None,
        "created_at": datetime.now(timezone.utc),
    }
    await post_repository.create_post(doc)

    # Rendered from the document that was stored, so the post the author sees is
    # the post the feed will show them a moment later.
    users = await user_repository.get_users_by_ids([author_id])
    return _post_view(doc, users)


def _post_view(row: dict, users: dict) -> dict:
    return {
        "post_id": row["_id"],
        "author": _display(row.get("author_id"), users),
        "text": row.get("text", ""),
        "job_id": row.get("job_id"),
        "company_name": row.get("company_name"),
        "created_at": row.get("created_at"),
    }


async def list_posts(limit: int = DEFAULT_PAGE, skip: int = 0) -> dict:
    """Most recent first, with authors resolved in one query rather than per row."""
    limit = max(1, min(limit, MAX_PAGE))
    skip = max(0, skip)

    rows = await post_repository.list_posts(limit=limit, skip=skip)
    users = await user_repository.get_users_by_ids([r.get("author_id") for r in rows])

    return {
        "total": await post_repository.count_posts(),
        "limit": limit,
        "skip": skip,
        "posts": [_post_view(row, users) for row in rows],
    }
