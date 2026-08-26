import request from "../../shared/api/client";

export function generateQuiz(repoUrl) {
  return request("/quiz/generate", {
    method: "POST",
    body: JSON.stringify({ repo_url: repoUrl }),
  });
}

export function generateDay1Quiz(jobId) {
  return request("/quiz/day1/generate", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId }),
  });
}

// Records answers and opens the follow-up round — does not return a score.
export function submitQuiz(quizId, answers) {
  return request("/quiz/submit", {
    method: "POST",
    body: JSON.stringify({ quiz_id: quizId, answers }),
  });
}

// Final grading: original answers plus the follow-up defence.
export function submitFollowUp(quizId, answer, secondsLeft) {
  return request("/quiz/followup", {
    method: "POST",
    body: JSON.stringify({ quiz_id: quizId, answer, seconds_left: secondsLeft }),
  });
}
