"""
Thin HTTP layer for authentication. No business logic here — only
request/response translation and HTTP error mapping. Logic lives in
app/services/auth_service.py.
"""
from fastapi import APIRouter, HTTPException

from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest):
    try:
        return await auth_service.register_user(req.email, req.password, req.role, req.name)
    except ValueError:
        # 409 rather than 400: the request was well-formed, the address is taken.
        raise HTTPException(409, "That email is already registered.")


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    try:
        return await auth_service.authenticate_user(req.email, req.password)
    except LookupError:
        # Deliberately identical for unknown email and wrong password.
        raise HTTPException(401, "Incorrect email or password.")
