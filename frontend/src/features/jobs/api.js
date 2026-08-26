import request from "../../shared/api/client";

export function fetchJobs() {
  return request("/jobs/");
}

export function applyToJob(jobId, userId, quizScoreId = null, day1QuizId = null, day1Score = null) {
  return request("/jobs/apply", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      user_id: userId,
      ...(quizScoreId ? { quiz_score_id: quizScoreId } : {}),
      ...(day1QuizId ? { day1_quiz_id: day1QuizId } : {}),
      ...(day1Score !== null && day1Score !== undefined ? { day1_score: day1Score } : {}),
    }),
  });
}

export function fetchEmployerApplications() {
  return request("/jobs/applications");
}

export function fetchCandidateApplications() {
  return request("/jobs/my-applications");
}

export function updateApplicationStatus(appId, status) {
  return request(`/jobs/applications/${appId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}


// --- company quiz ---------------------------------------------------------
//
// There is no createJob() here on purpose: the backend has no ungated route to
// call. A posting is created by the backend when submitFollowUp comes back with
// passed: true, from the draft sent to generateCompanyQuiz — which is why the
// draft is not sent again at the end.

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
