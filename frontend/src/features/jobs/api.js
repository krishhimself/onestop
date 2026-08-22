import request from "../../shared/api/client";

export function fetchJobs() {
  return request("/jobs/");
}

export function applyToJob(jobId, userId) {
  return request("/jobs/apply", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, user_id: userId }),
  });
}
