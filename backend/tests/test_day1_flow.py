"""
End-to-End Integration Test for Day-1 Readiness Test Flow:
1. Create a job with trial_repo_url attached by employer.
2. Candidate requests Day-1 quiz for that job posting.
3. Confirm questions are generated from the employer's trial repo (not candidate's).
4. Candidate submits answers, defends follow-up, and gets graded.
5. Candidate applies with the Day-1 quiz ID.
6. Confirm score lands on the application document.
7. Confirm day1_readiness lands in the reputation breakdown without blending into comprehension.
"""
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.services import job_service, quiz_service, reputation_service

EMPLOYER_TOKEN = create_access_token("employer-123", "employer")
CANDIDATE_TOKEN = create_access_token("candidate-456", "candidate")

employer_client = TestClient(app, headers={"Authorization": f"Bearer {EMPLOYER_TOKEN}"})
candidate_client = TestClient(app, headers={"Authorization": f"Bearer {CANDIDATE_TOKEN}"})


async def test_full_day1_readiness_lifecycle(monkeypatch):
    # Step 1: Employer job with trial_repo_url
    trial_repo = "https://github.com/employer-org/production-service"
    stored_jobs = {}
    stored_applications = {}
    stored_attempts = {}

    async def fake_create_job(doc):
        stored_jobs[doc["_id"]] = doc

    async def fake_get_job(job_id):
        return stored_jobs.get(job_id)

    async def fake_list_jobs(limit=100):
        return list(stored_jobs.values())

    async def fake_create_app(doc):
        stored_applications[doc["_id"]] = doc

    async def fake_save_attempt(doc):
        stored_attempts[doc["_id"]] = doc

    async def fake_get_attempt(quiz_id):
        return stored_attempts.get(quiz_id)

    async def fake_update_followup(quiz_id, answers, followup):
        stored_attempts[quiz_id]["answers"] = answers
        stored_attempts[quiz_id]["followup"] = followup
        stored_attempts[quiz_id]["status"] = "awaiting_followup"

    async def fake_update_result(quiz_id, result, followup=None):
        stored_attempts[quiz_id]["result"] = result
        stored_attempts[quiz_id]["status"] = "graded"
        if followup:
            stored_attempts[quiz_id]["followup"] = followup

    monkeypatch.setattr(job_service.job_repository, "create_job", fake_create_job)
    monkeypatch.setattr(job_service.job_repository, "get_job", fake_get_job)
    monkeypatch.setattr(job_service.job_repository, "list_jobs", fake_list_jobs)
    monkeypatch.setattr(job_service.job_repository, "create_application", fake_create_app)
    monkeypatch.setattr(job_service.quiz_repository, "get_attempt", fake_get_attempt)

    monkeypatch.setattr(quiz_service.job_repository, "get_job", fake_get_job)
    monkeypatch.setattr(quiz_service.quiz_repository, "save_attempt", fake_save_attempt)
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", fake_get_attempt)
    monkeypatch.setattr(quiz_service.quiz_repository, "update_followup", fake_update_followup)
    monkeypatch.setattr(quiz_service.quiz_repository, "update_result", fake_update_result)

    # Post job with trial repo
    job_id = await job_service.post_job({
        "company_name": "EmployerOrg",
        "role_title": "Core Distributed Systems Engineer",
        "description": "Maintain core data engine.",
        "tech_stack": ["Python", "FastAPI", "PostgreSQL"],
        "trial_repo_url": trial_repo,
        "posted_by": "employer-123",
    })

    # Step 2 & 3: Candidate generates Day-1 quiz for this job
    fetch_repo_mock = AsyncMock(return_value=[
        {"path": "engine/coordinator.py", "content": "class Coordinator: pass"}
    ])
    day1_gen_mock = AsyncMock(return_value=[
        {"question": "How does Coordinator maintain state across nodes?", "file_reference": "engine/coordinator.py", "category": "orientation"}
    ])
    monkeypatch.setattr(quiz_service.github_client, "fetch_repo_files", fetch_repo_mock)
    monkeypatch.setattr(quiz_service.gemini_client, "generate_day1_questions", day1_gen_mock)

    gen_resp = candidate_client.post("/api/v1/quiz/day1/generate", json={"job_id": job_id})
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()

    quiz_id = gen_data["quiz_id"]
    assert gen_data["job_id"] == job_id
    assert gen_data["repo_url"] == trial_repo
    # Confirm fetched files were from the employer's trial repo
    fetch_repo_mock.assert_called_once_with(trial_repo)

    # Step 4: Candidate answers questions and completes follow-up
    monkeypatch.setattr(quiz_service.gemini_client, "generate_followup_question",
                        AsyncMock(return_value="Why did Coordinator use that locking strategy?"))

    sub_resp = candidate_client.post("/api/v1/quiz/submit", json={
        "quiz_id": quiz_id,
        "answers": [{"question_id": gen_data["questions"][0]["id"], "answer": "It uses distributed leases", "seconds_left": 45.0}],
    })
    assert sub_resp.status_code == 200
    sub_data = sub_resp.json()
    assert sub_data["followup"]["question"] == "Why did Coordinator use that locking strategy?"

    # Grading follow-up
    monkeypatch.setattr(quiz_service.gemini_client, "grade_answers",
                        AsyncMock(return_value={"overall_score": 88.0, "breakdown": [{"question": "q1", "score": 9, "note": "Clear navigation"}]}))

    followup_resp = candidate_client.post("/api/v1/quiz/followup", json={
        "quiz_id": quiz_id,
        "answer": "Because leases prevent split-brain during partitions",
        "seconds_left": 30.0,
    })
    assert followup_resp.status_code == 200
    followup_data = followup_resp.json()
    assert followup_data["score"] == 88.0

    # Step 5 & 6: Candidate applies with Day-1 quiz ID and graded score
    app_resp = candidate_client.post("/api/v1/jobs/apply", json={
        "job_id": job_id,
        "user_id": "candidate-456",
        "day1_quiz_id": quiz_id,
        "day1_score": 88.0,
    })
    assert app_resp.status_code == 200
    app_id = app_resp.json()["id"]

    # Confirm score landed on the application
    application = stored_applications[app_id]
    assert application["job_id"] == job_id
    assert application["user_id"] == "candidate-456"
    assert application["day1_quiz_id"] == quiz_id
    assert application["day1_score"] == 88.0
    assert application["status"] == "applied"

    # Step 7: Reputation breakdown contains day1_readiness as separate unblended component
    monkeypatch.setattr(reputation_service.user_repository, "get_user_by_id",
                        AsyncMock(return_value={"_id": "candidate-456"}))
    monkeypatch.setattr(reputation_service.quiz_repository, "graded_scores_for_user",
                        AsyncMock(return_value=[94.0]))  # Candidate's own repo quiz
    monkeypatch.setattr(reputation_service.quiz_repository, "graded_day1_scores_for_user",
                        AsyncMock(return_value=[88.0]))  # Day-1 quiz score
    monkeypatch.setattr(reputation_service.job_repository, "count_applications_with_status",
                        AsyncMock(return_value=0))

    rep_data = await reputation_service.compute_reputation("candidate-456")
    assert rep_data["comprehension"] == 94, "candidate repo comprehension remains 94"
    assert rep_data["day1_readiness"] == 88, "Day-1 readiness is recorded as 88"
    assert rep_data["overall"] == round(94 * 0.75), "overall is strictly calculated from comprehension without day1 blending"
