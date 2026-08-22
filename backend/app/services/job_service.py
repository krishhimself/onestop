"""Business logic for job postings and applications."""
import uuid
from datetime import datetime

from app.repositories import job_repository


async def post_job(payload: dict) -> str:
    job_id = str(uuid.uuid4())
    doc = {**payload, "_id": job_id, "posted_at": datetime.utcnow()}
    await job_repository.create_job(doc)
    return job_id


async def get_jobs() -> list[dict]:
    return await job_repository.list_jobs()


async def apply_to_job(payload: dict) -> str:
    app_id = str(uuid.uuid4())
    doc = {**payload, "_id": app_id, "status": "applied"}
    await job_repository.create_application(doc)
    return app_id
