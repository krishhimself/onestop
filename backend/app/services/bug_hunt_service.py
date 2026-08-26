"""
Business logic for Bug Hunt mode.

Fetches candidate repo files, injects 2-3 subtle, realistic semantic bugs into
working copies via Gemini, stores the ground truth bugs exclusively server-side,
and grades candidate findings against the injected bugs.
"""
from datetime import datetime, timezone
import uuid

from app.integrations import gemini_client, github_client
from app.repositories import quiz_repository

BUG_HUNT_TIME_LIMIT_SECONDS = 180


async def create_bug_hunt(repo_url: str, user_id: str | None = None) -> dict:
    """
    Generate a Bug Hunt challenge from candidate's repository.

    The injected bugs answer key is stored strictly on the server-side attempt document
    and is NEVER returned to the client in the generation response.
    """
    files = await github_client.fetch_repo_files(repo_url)
    if not files:
        raise ValueError("no_source_files")

    modified_files, injected_bugs = await gemini_client.generate_bug_hunt(files)

    bug_hunt_id = str(uuid.uuid4())
    await quiz_repository.save_attempt(
        {
            "_id": bug_hunt_id,
            "type": "bughunt",
            "repo_url": repo_url,
            "user_id": user_id,
            "modified_files": modified_files,
            "injected_bugs": injected_bugs,  # Kept server-side for grading
            "status": "generated",
            "created_at": datetime.now(timezone.utc),
        }
    )

    # Return only the modified code and challenge metadata — answer key never crosses the wire.
    return {
        "bug_hunt_id": bug_hunt_id,
        "repo_url": repo_url,
        "modified_files": modified_files,
        "time_limit_seconds": BUG_HUNT_TIME_LIMIT_SECONDS,
        "expected_bug_count": len(injected_bugs),
    }


async def submit_and_grade_bug_hunt(
    bug_hunt_id: str, findings: list[dict], user_id: str
) -> dict:
    """
    Grade candidate's submitted findings against the ground truth bugs injected into the attempt.
    """
    attempt = await quiz_repository.get_attempt(bug_hunt_id)
    if not attempt or attempt.get("user_id") != user_id:
        raise LookupError("bug_hunt_not_found")

    injected_bugs = attempt.get("injected_bugs") or []
    result = await gemini_client.grade_bug_hunt(injected_bugs, findings)

    score = float(result.get("score", 0.0))
    await quiz_repository.update_attempt(
        bug_hunt_id,
        {
            "status": "completed",
            "score": score,
            "findings": findings,
            "result": result,
            "graded_at": datetime.now(timezone.utc),
        },
    )

    return {
        "bug_hunt_id": bug_hunt_id,
        "score": score,
        "bugs_caught": result.get("bugs_caught", 0),
        "total_bugs": result.get("total_bugs", len(injected_bugs)),
        "breakdown": result.get("breakdown", []),
        "summary": result.get("summary", ""),
    }
