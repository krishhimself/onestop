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


async def list_jobs_by_employer(employer_id: str, limit: int = 100) -> List[dict]:
    return await jobs_collection.find({"posted_by": employer_id}).to_list(limit)


async def create_application(doc: dict) -> None:
    await applications_collection.insert_one(doc)


async def get_application(app_id: str) -> Optional[dict]:
    return await applications_collection.find_one({"_id": app_id})


async def list_applications_for_job(job_id: str, limit: int = 100) -> List[dict]:
    return await applications_collection.find({"job_id": job_id}).to_list(limit)


async def list_applications_for_jobs(job_ids: list[str], limit: int = 200) -> List[dict]:
    if not job_ids:
        return []
    return await applications_collection.find({"job_id": {"$in": job_ids}}).to_list(limit)


async def list_applications_for_user(user_id: str, limit: int = 100) -> List[dict]:
    return await applications_collection.find({"user_id": user_id}).to_list(limit)


async def update_application_status(app_id: str, status: str) -> None:
    await applications_collection.update_one(
        {"_id": app_id},
        {"$set": {"status": status}}
    )


async def count_applications_with_status(user_id: str, statuses: tuple[str, ...]) -> int:
    """
    How many of this user's applications sit in one of `statuses`.

    Which statuses mean anything is the service's call, not this file's — this
    only counts. Counted server-side rather than by pulling the documents: the
    caller wants the number, not the applications.
    """
    return await applications_collection.count_documents(
        {"user_id": user_id, "status": {"$in": list(statuses)}}
    )

