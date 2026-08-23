"""
Business logic for authentication.

Endpoints stay thin: they translate these outcomes into status codes and never
inspect password material themselves.
"""
import uuid
from datetime import datetime, timezone

from app.core.security import create_access_token, hash_password, verify_password
from app.repositories import user_repository


async def register_user(email: str, password: str, role: str, name: str) -> dict:
    """Creates the account and returns a token, so signup does not need a second round trip."""
    normalised = email.strip().lower()

    if await user_repository.get_user_by_email(normalised):
        raise ValueError("email_taken")

    user_id = str(uuid.uuid4())
    await user_repository.create_user(
        {
            "_id": user_id,
            "email": normalised,
            # Shown only once `revealed` flips; until then it never leaves this file's
            # collection. See services/reputation_service.py.
            "name": name.strip(),
            "hashed_password": hash_password(password),
            "role": role,
            # Every account starts behind the pseudonym; reputation_service is the
            # only thing that flips this, once the reveal threshold is cleared.
            "revealed": False,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {
        "access_token": create_access_token(user_id, role),
        "token_type": "bearer",
        "role": role,
    }


async def authenticate_user(email: str, password: str) -> dict:
    """
    Verifies credentials and issues a token.

    Raises the same LookupError whether the email is unknown or the password is
    wrong, so the endpoint cannot become an oracle for which accounts exist.
    """
    user = await user_repository.get_user_by_email(email)
    if not user or not verify_password(password, user.get("hashed_password", "")):
        raise LookupError("bad_credentials")

    role = user.get("role", "candidate")
    return {
        "access_token": create_access_token(user["_id"], role),
        "token_type": "bearer",
        "role": role,
    }
