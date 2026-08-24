import { useEffect, useRef, useState } from "react";
import RepoInput from "./components/RepoInput";
import QuestionCard from "./components/QuestionCard";
import ScoreResult from "./components/ScoreResult";
import { generateQuiz, submitQuiz, submitFollowUp } from "./api";
import { ClockIcon, ShieldLockIcon } from "../../shared/components/Icons";

export default function QuizPage({ onUnauthorized, onNavigateReputation }) {
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
  // Paste signals per question. Also a ref — recording must stay invisible.
  const inputSignal = useRef({});
  // Guards against the auto-submit firing twice (expiry racing a manual click).
  const sent = useRef({ answers: false, followup: false });

  const limit = quiz?.time_limit_seconds ?? 75;

  function markExpired(id) {
    setExpired((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function handleReset() {
    setQuiz(null);
    setAnswers({});
    setFollowup(null);
    setFollowupAnswer("");
    setResult(null);
    setError("");
    setExpired(new Set());
    timeLeft.current = {};
    inputSignal.current = {};
    sent.current = { answers: false, followup: false };
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
      setError(e.message || "Failed to generate quiz from repository.");
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
      const payload = quiz.questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || "",
        seconds_left: timeLeft.current[q.id] ?? null,
        flagged_paste: inputSignal.current[q.id]?.flagged_paste ?? false,
        paste_delta: inputSignal.current[q.id]?.paste_delta ?? 0,
      }));
      const followupData = await submitQuiz(quiz.quiz_id, payload);
      setFollowup(followupData);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Failed to submit answers.");
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
      const resultData = await submitFollowUp(
        quiz.quiz_id,
        followupAnswer,
        timeLeft.current[id] ?? null
      );
      setResult(resultData);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Failed to grade follow-up answer.");
      sent.current.followup = false;
    } finally {
      setLoading(false);
    }
  }

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
    <div className="quiz-container">
      {/* Top Header Banner */}
      <div className="page-hero">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h1 className="page-hero-title">
            Repository Comprehension Quiz
          </h1>
          <span className="badge badge-accent">Live Evaluation</span>
        </div>
        <p className="page-hero-desc">
          Questions are grounded directly in your repository source files across problem understanding, algorithmic logic, tech stack awareness, and usage failure cases.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Input URL */}
      {!quiz && (
        <RepoInput
          value={repoUrl}
          onChange={setRepoUrl}
          onSubmit={handleGenerate}
          loading={loading}
        />
      )}

      {/* Step 2: Main Questions Interrogation Round */}
      {quiz && !followup && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="quiz-header-bar">
            <div className="quiz-rules-pill">
              <ClockIcon size={14} style={{ color: "var(--text-subtle)" }} />
              <span>
                <strong>{limit}s per question</strong> · Answers lock automatically on timer expiry
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="badge badge-mist">
                {quiz.questions.length} Questions
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>

          {quiz.questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              questionNumber={idx + 1}
              totalQuestions={quiz.questions.length}
              answer={answers[q.id]}
              timeLimit={limit}
              onTick={(id, s) => (timeLeft.current[id] = s)}
              onExpire={markExpired}
              onInputSignal={(id, sig) => (inputSignal.current[id] = sig)}
              onAnswerChange={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
            />
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting Answers..." : "Submit Round for Defense"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Adaptive Follow-Up Stage */}
      {followup && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="followup-card">
            <div className="followup-badge-callout">
              <span className="badge badge-accent">
                Adaptive Defense Round
              </span>
              <span className="badge badge-mist">
                {followup.time_limit_seconds}s Clock
              </span>
            </div>

            <h2 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>
              Defend Your Reasoning
            </h2>

            <p className="followup-explanation">
              The evaluation engine identified a specific formulation in your previous answers to push on. Defend your logic clearly in your own words.
            </p>

            <QuestionCard
              question={{
                id: followup.followup.id,
                question: followup.followup.question,
                category: "Adaptive Defense",
              }}
              answer={followupAnswer}
              timeLimit={followup.time_limit_seconds}
              onTick={(id, s) => (timeLeft.current[id] = s)}
              onExpire={markExpired}
              onAnswerChange={(_, val) => setFollowupAnswer(val)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleFollowUp}
                disabled={loading}
              >
                {loading ? "Grading Attempt..." : "Submit Follow-Up & Grade"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Final Score & Breakdown */}
      {result && (
        <ScoreResult
          result={result}
          complexity={quiz?.complexity}
          onReset={handleReset}
          onViewReputation={onNavigateReputation}
        />
      )}
    </div>
  );
}
