import request from "../../shared/api/client";

export function fetchJobs() {
  return request("/jobs/");
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

// --- company quiz ---------------------------------------------------------
//
// There is no createJob() here on purpose: the backend has no ungated route to
// call. A posting is created by the backend when submitCompanyFollowUp comes back
// with passed: true, from the draft sent to generateCompanyQuiz — which is why the
// draft is not sent again at the end. One briefly existed and posted to /jobs/,
// a route that does not exist; if it reappears, the gate has been removed.

export function generateCompanyQuiz(draft) {
  return request("/jobs/company-quiz/generate", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

// Records answers and opens the follow-up round — does not grade or post.
export function submitCompanyQuiz(quizId, answers) {
  return request("/jobs/company-quiz/submit", {
    method: "POST",
    body: JSON.stringify({ quiz_id: quizId, answers }),
  });
}

// Final grading. Publishes the posting if it clears the bar.
export function submitCompanyFollowUp(quizId, answer, secondsLeft) {
  return request("/jobs/company-quiz/followup", {
    method: "POST",
    body: JSON.stringify({ quiz_id: quizId, answer, seconds_left: secondsLeft }),
  });
}
