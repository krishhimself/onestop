"""
Business logic for the repo-quiz feature. This is the core mechanism
of the whole platform — everything else (score tab, reputation, company
quiz) eventually calls into or reuses this.
"""
import uuid

from app.integrations import gemini_client, github_client
from app.repositories import quiz_repository


async def create_quiz(repo_url: str, user_id: str | None) -> dict:
    files = await github_client.fetch_repo_files(repo_url)
    if not files:
        raise ValueError("no_source_files")

    raw_questions, complexity = await gemini_client.generate_quiz_questions(files)
    questions = [{"id": str(uuid.uuid4()), **q} for q in raw_questions]

    quiz_id = str(uuid.uuid4())
    await quiz_repository.save_attempt(
        {
            "_id": quiz_id,
            "repo_url": repo_url,
            "user_id": user_id,
            "questions": questions,
            "complexity": complexity,
            "status": "generated",
        }
    )
    return {
        "quiz_id": quiz_id,
        "repo_url": repo_url,
        "questions": questions,
        "complexity": complexity,
    }


async def grade_quiz(quiz_id: str, answers: list[dict]) -> dict:
    attempt = await quiz_repository.get_attempt(quiz_id)
    if not attempt:
        raise LookupError("quiz_not_found")

    result = await gemini_client.grade_answers(attempt["questions"], answers)
    await quiz_repository.update_result(quiz_id, result)
    return result
