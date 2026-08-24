"""
Thin HTTP layer for the community feed. No business logic here — only
request/response translation and HTTP error mapping. Logic lives in
app/services/community_service.py.

Create and list, text only. No comments, likes, reactions, or media: the feed is
a place to say something, not a social network.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.schemas.community import PostCreateRequest, PostListResponse, PostResponse
from app.services import community_service

router = APIRouter()


@router.post("/", response_model=PostResponse, status_code=201)
async def create_post(req: PostCreateRequest, user: dict = Depends(get_current_user)):
    try:
        return await community_service.create_post(
            user["user_id"], req.text, req.job_id, req.company_name
        )
    except LookupError:
        raise HTTPException(404, "That job posting does not exist.")
    except ValueError:
        raise HTTPException(400, "A post needs text.")


@router.get("/", response_model=PostListResponse)
async def list_posts(
    limit: int = Query(community_service.DEFAULT_PAGE, ge=1, le=community_service.MAX_PAGE),
    skip: int = Query(0, ge=0),
):
    """Most recent first. Open to read, like the profile and reputation views."""
    return await community_service.list_posts(limit=limit, skip=skip)
