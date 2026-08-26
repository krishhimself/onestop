"""Business logic for job postings and applications."""
import uuid
from datetime import datetime

from app.repositories import job_repository, quiz_repository
from app.services import reputation_service


async def post_job(payload: dict) -> str:
    job_id = str(uuid.uuid4())
    doc = {**payload, "_id": job_id, "posted_at": datetime.utcnow()}
    await job_repository.create_job(doc)
    return job_id


async def get_jobs() -> list[dict]:
    return await job_repository.list_jobs()


async def apply_to_job(payload: dict) -> str:
    app_id = str(uuid.uuid4())
    doc = {
        **payload,
        "_id": app_id,
        "status": payload.get("status") or "applied",
        "applied_at": payload.get("applied_at") or datetime.utcnow(),
    }

    # If a day1_quiz_id or quiz_score_id was provided without day1_score,
    # pull the graded score from the attempt if available.
    quiz_id = payload.get("day1_quiz_id") or payload.get("quiz_score_id")
    if quiz_id and doc.get("day1_score") is None:
        attempt = await quiz_repository.get_attempt(quiz_id)
        if attempt and attempt.get("status") == "graded":
            score = (attempt.get("result") or {}).get("overall_score")
            if score is not None:
                doc["day1_score"] = float(score)

    await job_repository.create_application(doc)
    return app_id


async def get_applications_for_employer(employer_id: str) -> list[dict]:
    """
    Returns all candidate applications for postings owned by the employer.
    
    Candidate identity respects the reveal threshold: unrevealed candidates
    appear as 'Anonymous Candidate' with no email, upholding the anonymous-first rule.
    """
    jobs = await job_repository.list_jobs_by_employer(employer_id)
    if not jobs:
        return []

    jobs_map = {j["_id"]: j for j in jobs}
    job_ids = list(jobs_map.keys())
    apps = await job_repository.list_applications_for_jobs(job_ids)

    out = []
    for app in apps:
        job = jobs_map.get(app.get("job_id"), {})
        candidate_id = app.get("user_id")

        candidate_name = "Anonymous Candidate"
        candidate_email = None
        revealed = False
        comprehension_score = None
        day1_score = app.get("day1_score")

        if candidate_id:
            try:
                profile = await reputation_service.get_public_profile(candidate_id)
                candidate_name = profile.get("name") or "Anonymous Candidate"
                candidate_email = profile.get("email")
                revealed = bool(profile.get("revealed"))
            except LookupError:
                pass

            try:
                rep = await reputation_service.compute_reputation(candidate_id)
                comprehension_score = rep.get("comprehension")
                if day1_score is None:
                    day1_score = rep.get("day1_readiness")
            except LookupError:
                pass

        out.append({
            "id": app["_id"],
            "job_id": app.get("job_id"),
            "role_title": job.get("role_title") or "Unknown Role",
            "company_name": job.get("company_name") or "Unknown Company",
            "user_id": candidate_id,
            "candidate_name": candidate_name,
            "candidate_email": candidate_email,
            "revealed": revealed,
            "comprehension_score": comprehension_score,
            "day1_score": day1_score,
            "day1_quiz_id": app.get("day1_quiz_id"),
            "status": app.get("status") or "applied",
            "applied_at": app.get("applied_at"),
        })

    return out


async def get_applications_for_candidate(candidate_id: str) -> list[dict]:
    """Returns applications submitted by a specific candidate with job metadata."""
    apps = await job_repository.list_applications_for_user(candidate_id)
    out = []
    for app in apps:
        job = await job_repository.get_job(app.get("job_id")) or {}
        out.append({
            "id": app["_id"],
            "job_id": app.get("job_id"),
            "role_title": job.get("role_title") or "Unknown Role",
            "company_name": job.get("company_name") or "Unknown Company",
            "tech_stack": job.get("tech_stack") or [],
            "trial_repo_url": job.get("trial_repo_url"),
            "status": app.get("status") or "applied",
            "day1_score": app.get("day1_score"),
            "applied_at": app.get("applied_at"),
        })
    return out


async def update_application_status(app_id: str, status: str, employer_id: str) -> dict:
    """
    Updates the status of an application. Only the employer who posted the job
    can update the status of its applications.
    """
    app = await job_repository.get_application(app_id)
    if not app:
        raise LookupError("application_not_found")

    job = await job_repository.get_job(app.get("job_id"))
    if not job or job.get("posted_by") != employer_id:
        raise PermissionError("not_authorized")

    await job_repository.update_application_status(app_id, status)
    return {"id": app_id, "status": status}

