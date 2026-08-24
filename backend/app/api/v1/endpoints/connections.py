"""
Thin HTTP layer for connections. No business logic here — only request/response
translation and HTTP error mapping. Logic lives in
app/services/community_service.py.

Instant and mutual: there is no request to send, accept, or decline, so there is
no pending state and no endpoint to advance one.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user
from app.schemas.community import ConnectionsResponse, ConnectResponse
from app.services import community_service

router = APIRouter()


@router.post("/{user_id}/connect", response_model=ConnectResponse)
async def connect(user_id: str, user: dict = Depends(get_current_user)):
    """
    Connect the caller to `user_id`. Idempotent — a repeat returns the existing
    connection with `created: false` rather than failing.
    """
    try:
        return await community_service.connect(user["user_id"], user_id)
    except LookupError:
        raise HTTPException(404, "Profile not found")
    except ValueError:
        raise HTTPException(400, "You cannot connect to yourself.")


@router.get("/{user_id}/connections", response_model=ConnectionsResponse)
async def list_connections(user_id: str):
    try:
        return await community_service.list_connections(user_id)
    except LookupError:
        raise HTTPException(404, "Profile not found")
