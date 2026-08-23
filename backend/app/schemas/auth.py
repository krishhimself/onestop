"""Request/response DTOs for the auth endpoints — what crosses the wire."""
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

Role = Literal["candidate", "employer"]


# Stripped before it is measured, so a name of spaces is rejected rather than
# stored as one. The cap is a storage guard, not a claim about how long real
# names are — it is deliberately generous.
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class RegisterRequest(BaseModel):
    # Required: this is the name an employer sees once the candidate clears the
    # reveal threshold, and a funnel that reveals an email address instead is not
    # the introduction the product promises.
    name: Name
    email: EmailStr
    # bcrypt only considers the first 72 bytes, so longer input is rejected rather
    # than silently truncated at the boundary.
    password: str = Field(min_length=8, max_length=72)
    role: Role = "candidate"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
