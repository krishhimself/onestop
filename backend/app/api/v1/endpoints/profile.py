"""
Thin HTTP layer for candidate profiles. No business logic here — only
request/response translation and HTTP error mapping. Logic lives in
app/services/reputation_service.py.

Deliberately open: the funnel exists so an employer can browse candidates before
either side has committed to anything, and requiring a token to read a profile
that is anonymous by construction would gate the wrong thing. Anonymity, not
authentication, is what protects the candidate here.
"""
from fastapi import APIRouter, HTTPException

from app.schemas.profile import ProfileResponse
from app.services import reputation_service

router = APIRouter()


@router.get("/{user_id}", response_model=ProfileResponse)
async def get_profile(user_id: str):
    """
    Returns the profile, revealing the candidate if they have cleared the threshold.

    A GET that can flip `revealed` is a write on a read path, which is not usually
    right. It is here because the reveal belongs to the candidate's own record —
    it depends on what they scored, never on who is looking — so any viewer
    triggering it produces the same result, and it is idempotent after the first.
    """
    try:
        return await reputation_service.get_public_profile(user_id)
    except LookupError:
        raise HTTPException(404, "Profile not found")
