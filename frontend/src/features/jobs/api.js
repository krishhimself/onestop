import request from "../../shared/api/client";

export function fetchJobs() {
  return request("/jobs/");
}

export function createJob(jobData) {
  return request("/jobs/", {
    method: "POST",
    body: JSON.stringify(jobData),
  });
}

export function applyToJob(jobId, userId, quizScoreId = null) {
  return request("/jobs/apply", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      user_id: userId,
      ...(quizScoreId ? { quiz_score_id: quizScoreId } : {}),
    }),
  });
}
