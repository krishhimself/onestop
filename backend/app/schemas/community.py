"""Request/response DTOs for the community endpoints — what crosses the wire."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.services.community_service import MAX_POST_LENGTH


class PersonSummary(BaseModel):
    """
    A person as a list view may show them.

    `name` carries the pseudonym while `revealed` is False — the same rule the
    profile response follows, so a feed or a connections list never becomes the
    hole the anonymous funnel is plugged everywhere else.
    """

    user_id: str
    name: str
    revealed: bool


class ConnectResponse(BaseModel):
    connection_id: str
    user_id: str
    connected_to: str
    # False when the connection already existed. Connecting twice is a no-op
    # rather than an error, so this is how a caller tells the two apart.
    created: bool


class ConnectionSummary(PersonSummary):
    connected_at: Optional[datetime] = None


class ConnectionsResponse(BaseModel):
    user_id: str
    count: int
    connections: List[ConnectionSummary]


class PostCreateRequest(BaseModel):
    # author is deliberately absent: it comes from the access token, so a post
    # cannot be attributed to somebody else by editing the body.
    text: str = Field(min_length=1, max_length=MAX_POST_LENGTH)
    job_id: Optional[str] = None
    company_name: Optional[str] = None


class PostResponse(BaseModel):
    post_id: str
    author: PersonSummary
    text: str
    job_id: Optional[str] = None
    company_name: Optional[str] = None
    created_at: Optional[datetime] = None


class PostListResponse(BaseModel):
    total: int
    limit: int
    skip: int
    posts: List[PostResponse]
