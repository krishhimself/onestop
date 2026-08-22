"""Only file allowed to query the jobs / applications collections directly."""
from typing import List, Optional

from app.db.mongodb import get_collection

jobs_collection = get_collection("jobs")
applications_collection = get_collection("applications")


async def create_job(doc: dict) -> None:
    await jobs_collection.insert_one(doc)


async def list_jobs(limit: int = 100) -> List[dict]:
    return await jobs_collection.find().to_list(limit)


async def get_job(job_id: str) -> Optional[dict]:
    return await jobs_collection.find_one({"_id": job_id})


async def create_application(doc: dict) -> None:
    await applications_collection.insert_one(doc)
