"""Request/response DTOs for the auth endpoints — what crosses the wire."""
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["candidate", "employer"]


class RegisterRequest(BaseModel):
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
