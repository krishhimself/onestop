import { useEffect, useRef, useState } from "react";
import RepoInput from "./components/RepoInput";
import QuestionCard from "./components/QuestionCard";
import ScoreResult from "./components/ScoreResult";
import { generateQuiz, submitQuiz, submitFollowUp } from "./api";

export default function QuizPage({ onUnauthorized }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [followup, setFollowup] = useState(null);
  const [followupAnswer, setFollowupAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(() => new Set());

  // Live countdown per question, kept in a ref so ticking never re-renders the page.
  const timeLeft = useRef({});
  // Paste signals per question. Also a ref — recording must stay invisible, and
  // re-rendering on it would risk leaking that something was noticed.
  const inputSignal = useRef({});
  // Guards against the auto-submit firing twice (expiry racing a manual click).
  const sent = useRef({ answers: false, followup: false });

  const limit = quiz?.time_limit_seconds ?? 75;

  function markExpired(id) {
    setExpired((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);
    setFollowup(null);
    setFollowupAnswer("");
    setExpired(new Set());
    timeLeft.current = {};
    inputSignal.current = {};
    sent.current = { answers: false, followup: false };
    try {
      const data = await generateQuiz(repoUrl);
      setQuiz(data);
      setAnswers({});
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (sent.current.answers) return;
    sent.current.answers = true;
    setLoading(true);
    setError("");
    try {
      // Every question is sent, answered or not — a blank answer is itself a result.
      const payload = quiz.questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || "",
        seconds_left: timeLeft.current[q.id] ?? null,
        flagged_paste: inputSignal.current[q.id]?.flagged_paste ?? false,
        paste_delta: inputSignal.current[q.id]?.paste_delta ?? 0,
      }));
      setFollowup(await submitQuiz(quiz.quiz_id, payload));
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message);
      sent.current.answers = false;
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp() {
    if (sent.current.followup) return;
    sent.current.followup = true;
    setLoading(true);
    setError("");
    try {
      const id = followup.followup.id;
      setResult(
        await submitFollowUp(quiz.quiz_id, followupAnswer, timeLeft.current[id] ?? null)
      );
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message);
      sent.current.followup = false;
    } finally {
      setLoading(false);
    }
  }

  // When every question's clock has run out, submit whatever is there.
  useEffect(() => {
    if (quiz && !followup && !result && expired.size >= quiz.questions.length) {
      handleSubmit();
    }
  }, [expired, quiz, followup, result]);

  const followupExpired = followup && expired.has(followup.followup.id);
  useEffect(() => {
    if (followupExpired && !result) handleFollowUp();
  }, [followupExpired, result]);

  return (
    <div className="container">
      <h1>Repo Quiz</h1>
      <p className="tagline">Paste a public GitHub repo. We'll ask you about your own code.</p>

      <RepoInput value={repoUrl} onChange={setRepoUrl} onSubmit={handleGenerate} loading={loading} />

      {error && <p className="error">{error}</p>}

      {quiz && !followup && !result && (
        <div className="quiz">
          <p className="rules">
            {limit}s per question · answers lock when the timer runs out
          </p>
          {quiz.questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              answer={answers[q.id]}
              timeLimit={limit}
              onTick={(id, s) => (timeLeft.current[id] = s)}
              onExpire={markExpired}
              onInputSignal={(id, sig) => (inputSignal.current[id] = sig)}
              onAnswerChange={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
            />
          ))}
          <button onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : "Submit Answers"}
          </button>
        </div>
      )}

      {followup && !result && (
        <div className="quiz">
          <p className="rules">
            One follow-up on what you just wrote. Same {followup.time_limit_seconds}s, same
            rules.
          </p>
          <QuestionCard
            question={{ id: followup.followup.id, question: followup.followup.question }}
            answer={followupAnswer}
            timeLimit={followup.time_limit_seconds}
            onTick={(id, s) => (timeLeft.current[id] = s)}
            onExpire={markExpired}
            onAnswerChange={(_, val) => setFollowupAnswer(val)}
          />
          <button onClick={handleFollowUp} disabled={loading}>
            {loading ? "Grading..." : "Submit Follow-up"}
          </button>
        </div>
      )}

      {result && <ScoreResult result={result} complexity={quiz?.complexity} />}
    </div>
  );
}
