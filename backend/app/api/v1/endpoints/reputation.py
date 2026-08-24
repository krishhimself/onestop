"""
Thin HTTP layer for the reputation score. No business logic here — only
request/response translation and HTTP error mapping. Logic lives in
app/services/reputation_service.py.

Open for the same reason profiles are: the funnel exists so an employer can weigh
a candidate before either side has committed to anything, and the payload carries
no identity — only what the candidate has demonstrated.
"""
from fastapi import APIRouter, HTTPException

from app.schemas.reputation import ReputationResponse
from app.services import reputation_service

router = APIRouter()


@router.get("/{user_id}/reputation", response_model=ReputationResponse)
async def get_reputation(user_id: str):
    try:
        breakdown = await reputation_service.compute_reputation(user_id)
    except LookupError:
        raise HTTPException(404, "Profile not found")
    return {"user_id": user_id, **breakdown}
