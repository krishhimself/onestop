import request from "../../shared/api/client";

export function generateQuiz(repoUrl) {
  return request("/quiz/generate", {
    method: "POST",
    body: JSON.stringify({ repo_url: repoUrl }),
  });
}

export function submitQuiz(quizId, answers) {
  return request("/quiz/submit", {
    method: "POST",
    body: JSON.stringify({ quiz_id: quizId, answers }),
  });
}
