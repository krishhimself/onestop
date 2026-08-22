"""
Password hashing and access tokens.

Nothing else in the app should import passlib or jwt directly — go through here so
the algorithm, expiry, and claim shape live in one place.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt is pinned below 5.x in requirements: passlib 1.7.4's bcrypt backend fails
# its own self-test against bcrypt 5, which breaks hashing entirely rather than
# just warning.
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# passlib probes bcrypt.__about__, which 4.1+ removed. It catches the failure and
# carries on, but logs the traceback on every import. Silence the cosmetic noise
# without hiding anything that actually matters.
logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.CRITICAL)

# bcrypt silently uses only the first 72 bytes. Rejecting longer input is better
# than accepting a password whose tail never mattered.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("password_too_long")
    return _pwd.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return False
    try:
        return _pwd.verify(password, hashed)
    except ValueError:
        # Malformed or truncated hash in storage — treat as a failed login rather
        # than a 500, so a bad row cannot be used to probe the endpoint.
        return False


def create_access_token(user_id: str, role: str, expires_minutes: Optional[int] = None) -> str:
    now = datetime.now(timezone.utc)
    minutes = settings.jwt_expire_minutes if expires_minutes is None else expires_minutes
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """
    Returns the claims, or raises ValueError for anything untrustworthy.

    Callers get one failure mode rather than jwt's several, so no endpoint can
    accidentally treat an expired token differently from a forged one.
    """
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise ValueError("invalid_token") from exc
