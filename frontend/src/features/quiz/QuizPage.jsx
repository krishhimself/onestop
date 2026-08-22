import { useState } from "react";
import RepoInput from "./components/RepoInput";
import QuestionCard from "./components/QuestionCard";
import ScoreResult from "./components/ScoreResult";
import { generateQuiz, submitQuiz } from "./api";

export default function QuizPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await generateQuiz(repoUrl);
      setQuiz(data);
      setAnswers({});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const payload = Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer,
      }));
      const data = await submitQuiz(quiz.quiz_id, payload);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>Repo Quiz</h1>
      <p className="tagline">Paste a public GitHub repo. We'll ask you about your own code.</p>

      <RepoInput value={repoUrl} onChange={setRepoUrl} onSubmit={handleGenerate} loading={loading} />

      {error && <p className="error">{error}</p>}

      {quiz && !result && (
        <div className="quiz">
          {quiz.questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              answer={answers[q.id]}
              onAnswerChange={(id, val) => setAnswers({ ...answers, [id]: val })}
            />
          ))}
          <button onClick={handleSubmit} disabled={loading}>
            {loading ? "Grading..." : "Submit Answers"}
          </button>
        </div>
      )}

      {result && <ScoreResult result={result} />}
    </div>
  );
}
