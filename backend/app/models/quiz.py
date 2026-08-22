"""
Documents this app's shape, MongoDB doesn't enforce it. Kept here so
anyone (human or agentic IDE) touching quiz_repository.py knows exactly
what a quiz_attempts document looks like.

quiz_attempts collection:
{
  "_id": str (uuid4),
  "repo_url": str,
  "user_id": str | None,
  "questions": [
    {"id": str, "question": str, "file_reference": str | None}
  ],
  "status": "generated" | "graded",
  "result": {
    "overall_score": float,
    "breakdown": [{"question": str, "score": int, "note": str}]
  } | None,
}
"""
