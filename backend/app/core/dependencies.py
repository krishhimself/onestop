"""
FastAPI dependencies shared across endpoints.

Kept out of security.py so that module stays importable by tests and scripts
without dragging in FastAPI request handling.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token

# auto_error=False so a missing header reaches us as None and we can answer with a
# consistent 401 rather than letting the shape of the failure vary.
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Resolves the caller from the Authorization header, or 401s."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(401, "Not authenticated")
    try:
        claims = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(401, "Invalid or expired token")

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid or expired token")
    return {"user_id": user_id, "role": claims.get("role")}


async def get_current_employer(user: dict = Depends(get_current_user)) -> dict:
    """
    Same as get_current_user, but only for employer accounts.

    The role is read off the signed token rather than a request body, so a
    candidate account cannot post jobs by claiming to be a company. 403 rather
    than 404: which routes exist is not a secret, and a candidate who wound up
    here should be told why the door is shut.
    """
    if user.get("role") != "employer":
        raise HTTPException(403, "Only employer accounts can post jobs.")
    return user
