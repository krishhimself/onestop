"""
jobs collection:
{
  "_id": str (uuid4),
  "company_name": str,
  "role_title": str,
  "description": str,
  "tech_stack": list[str],
  "posted_at": datetime,
}

applications collection:
{
  "_id": str (uuid4),
  "job_id": str,
  "user_id": str,
  "quiz_score_id": str | None,
  "status": "applied" | "reviewed" | "rejected" | "accepted",
}
"""
