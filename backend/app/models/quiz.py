"""
Documents this app's shape, MongoDB doesn't enforce it. Kept here so
anyone (human or agentic IDE) touching quiz_repository.py knows exactly
what a quiz_attempts document looks like.

quiz_attempts collection:
{
  "_id": str (uuid4),
  "type": "candidate" | "day1", # candidate repo comprehension vs Day-1 readiness quiz
  "job_id": str | None,         # attached job_id if type == "day1"
  "repo_url": str,
  "user_id": str,  # owner; set from the access token, never from the request body.
                   # Every read after creation goes through
                   # quiz_service._load_owned_attempt, which refuses an attempt
                   # belonging to anyone else.
  "questions": [
    {"id": str, "question": str, "file_reference": str | None,
     "category": "problem" | "logic" | "stack" | "usage" | "orientation" | "navigation" | "blast_radius" | "data_flow" | None}
  ],
  "complexity": {
    "tier": "trivial" | "moderate" | "complex" | "unknown",
    "reasoning": str
  },
  "answers": [
    {"question_id": str, "answer": str, "seconds_left": float | None}
  ] | None,
  "followup": {
    "id": str,
    "question": str,
    "targets_question_id": str,
    "answer": str | None,
    "seconds_left": float | None
  } | None,
  "status": "generated" | "awaiting_followup" | "graded",
  "result": {
    "overall_score": float,
    "breakdown": [{"question": str, "score": int, "note": str}]
  } | None,
}
"""
