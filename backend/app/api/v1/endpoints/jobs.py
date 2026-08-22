"""Thin HTTP layer for job postings and applications."""
from fastapi import APIRouter

from app.schemas.job import ApplicationRequest, JobCreateRequest
from app.services import job_service

router = APIRouter()


@router.post("/")
async def create_job(job: JobCreateRequest):
    job_id = await job_service.post_job(job.dict())
    return {"id": job_id}


@router.get("/")
async def list_jobs():
    return await job_service.get_jobs()


@router.post("/apply")
async def apply(application: ApplicationRequest):
    app_id = await job_service.apply_to_job(application.dict())
    return {"id": app_id}
