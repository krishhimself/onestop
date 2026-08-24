"""
jobs collection:
{
  "_id": str (uuid4),
  "company_name": str,
  "role_title": str,
  "description": str,
  "tech_stack": list[str],
  "posted_by": str,          # user_id of the employer who defended the quiz
  "company_quiz_id": str,    # the attempt that unlocked this posting
  "posted_at": datetime,
}

Every document here is written by services/company_quiz_service.py on a passing
grade, from the draft that was stored when the questions were generated. There is
no route that inserts a job any other way, so a posting in this collection has by
construction been defended by the account named in `posted_by`. Documents created
before the gate existed have neither key.

applications collection:
{
  "_id": str (uuid4),
  "job_id": str,
  "user_id": str,
  "quiz_score_id": str | None,
  "status": "applied" | "reviewed" | "rejected" | "accepted",
}

company_quiz_attempts collection (see repositories/company_quiz_repository.py for
why this is not merged into quiz_attempts):
{
  "_id": str (uuid4),
  "user_id": str,            # the employer; ownership is checked on every step
  "draft": {company_name, role_title, description, tech_stack},
  "questions": [{"id": str, "question": str, "category": str}],
  "answers": [{"question_id": str, "answer": str, "seconds_left": float | None,
               "flagged_paste": bool, "paste_delta": int}],
  "followup": {"id": str, "question": str, "targets_question_id": str,
               "answer": str | None, "seconds_left": float | None},
  "result": {"overall_score": float, "breakdown": [...]},
  "passed": bool,
  "job_id": str | None,      # the posting this attempt produced, None if it failed
  "status": "generated" | "awaiting_followup" | "graded",
}

`status: "graded"` is terminal: the attempt keeps whatever job_id it produced and
is never re-graded, so it cannot be replayed into a second posting.
"""
