"""Request/response DTOs for the profile endpoint — what crosses the wire."""
from pydantic import BaseModel

from app.schemas.auth import Role


class ProfileResponse(BaseModel):
    """
    A profile as a viewer may see it.

    `name` carries the pseudonym while `revealed` is False, and `email` is None —
    the fields are absent from the payload rather than blanked by the client, so
    an unrevealed identity is never sent to the browser at all.
    """
    user_id: str
    name: str | None
    email: str | None
    role: Role
    revealed: bool
