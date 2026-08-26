import { useEffect, useRef, useState } from "react";
import RepoInput from "./components/RepoInput";
import QuestionCard from "./components/QuestionCard";
import ScoreResult from "./components/ScoreResult";
import { generateQuiz, generateDay1Quiz, submitQuiz, submitFollowUp } from "./api";
import { ClockIcon, ShieldLockIcon } from "../../shared/components/Icons";

export default function QuizPage({
  onUnauthorized,
  onNavigateReputation,
  isDay1 = false,
  day1Job = null,
  onDay1Complete = null,
  onCancel = null,
}) {
  const [repoUrl, setRepoUrl] = useState(day1Job?.trial_repo_url || "");
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
    if (onCancel) onCancel();
  }

  async function handleGenerateDay1() {
    if (!day1Job?.id) return;
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
      const data = await generateDay1Quiz(day1Job.id);
      setQuiz(data);
      setAnswers({});
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Failed to generate Day-1 Readiness quiz from trial repository.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isDay1 && day1Job?.id && !quiz) {
      handleGenerateDay1();
    }
  }, [isDay1, day1Job?.id]);

  async function handleGenerate() {
    if (isDay1) {
      return handleGenerateDay1();
    }
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
      {isDay1 ? (
        <div className="page-hero">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 className="page-hero-title">
                Day-1 Readiness Test
              </h1>
              <span className="badge badge-accent">Unfamiliar Codebase</span>
            </div>

            {onCancel && (
              <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                Cancel Test
              </button>
            )}
          </div>
          <p className="page-hero-desc" style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)", marginBottom: "4px" }}>
            "You've never seen this code. Show us how fast you find your way."
          </p>
          <p className="page-hero-desc">
            {day1Job ? (
              <>Evaluating role: <strong>{day1Job.role_title}</strong> at <strong>{day1Job.company_name}</strong>. Questions test orientation speed on the attached codebase — finding key modules, tracing data flows, identifying blast radius, and understanding core architecture.</>
            ) : (
              <>Questions test orientation speed on an unfamiliar repository — finding key modules, tracing data flows, identifying blast radius, and understanding core architecture.</>
            )}
          </p>
        </div>
      ) : (
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
      )}

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Input URL (only for candidate's own repo quiz, or loading state for Day-1) */}
      {!quiz && (
        isDay1 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
            <ClockIcon size={32} style={{ color: "var(--accent)", marginBottom: "12px" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>
              Generating Day-1 Readiness Test
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", maxWidth: "440px", margin: "0 auto 16px" }}>
              Analyzing the employer's trial repository and crafting unfamiliar-codebase orientation questions...
            </p>
            {loading ? (
              <span className="badge badge-mist">Reading trial repository...</span>
            ) : (
              <button className="btn btn-primary" onClick={handleGenerateDay1}>
                Start Day-1 Readiness Test
              </button>
            )}
          </div>
        ) : (
          <RepoInput
            value={repoUrl}
            onChange={setRepoUrl}
            onSubmit={handleGenerate}
            loading={loading}
          />
        )
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
          isDay1={isDay1}
          day1Job={day1Job}
          onCompleteDay1={
            onDay1Complete && quiz?.quiz_id
              ? () => onDay1Complete(result, quiz.quiz_id)
              : null
          }
        />
      )}
    </div>
  );
}
