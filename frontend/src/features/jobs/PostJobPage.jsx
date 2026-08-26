import { useEffect, useRef, useState } from "react";
import JobDraftForm from "./components/JobDraftForm";
import PostingResult from "./components/PostingResult";
import QuestionCard from "../quiz/components/QuestionCard";
import {
  generateCompanyQuiz,
  submitCompanyFollowUp,
  submitCompanyQuiz,
} from "./api";
import {
  ShieldLockIcon,
  CheckCircleIcon,
  ClockIcon,
  JobsIcon,
} from "../../shared/components/Icons";

const EMPTY_DRAFT = { company_name: "", role_title: "", description: "", tech_stack: "", trial_repo_url: "" };

export default function PostJobPage({ onUnauthorized, onCancel, onViewJobs }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
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

  function reset() {
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
    reset();
    try {
      const data = await generateCompanyQuiz({
        company_name: draft.company_name.trim(),
        role_title: draft.role_title.trim(),
        description: draft.description.trim(),
        tech_stack: draft.tech_stack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ...(draft.trial_repo_url?.trim() ? { trial_repo_url: draft.trial_repo_url.trim() } : {}),
      });
      setQuiz(data);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Failed to generate audit questions from that posting.");
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
      const res = await submitCompanyQuiz(quiz.quiz_id, payload);
      setFollowup(res);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Submission failed.");
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
      const res = await submitCompanyFollowUp(
        quiz.quiz_id,
        followupAnswer,
        timeLeft.current[id] ?? null
      );
      setResult(res);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Grading failed.");
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

  const drafting = !quiz && !result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Top Header */}
      <div className="page-hero">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h1 className="page-hero-title">
            Company-Side Technical Audit
          </h1>
          <span className="badge badge-accent">Proof-Gated Publishing</span>
        </div>
        <p className="page-hero-desc">
          Write the posting, then defend it. Roles are published only if you score 70+ on live architectural questions generated from your draft.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {drafting && (
        <JobDraftForm
          draft={draft}
          onChange={setDraft}
          onSubmit={handleGenerate}
          loading={loading}
          onCancel={onCancel}
        />
      )}

      {/* Step 2: Main Question Interrogation */}
      {quiz && !followup && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="card alert-info" style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <ClockIcon size={16} style={{ color: "var(--accent)" }} />
              <span>
                <strong>{limit}s per question</strong> · Answers lock on timer expiry · Draft is held server-side until graded.
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {quiz.questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                answer={answers[q.id] || ""}
                timeLimit={limit}
                onTick={(id, s) => (timeLeft.current[id] = s)}
                onExpire={markExpired}
                onInputSignal={(id, sig) => (inputSignal.current[id] = sig)}
                onAnswerChange={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
              />
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            {onCancel && (
              <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
                Cancel
              </button>
            )}
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting for jury review..." : "Submit Answers & Open Follow-up"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Adaptive Follow-up Question Defense */}
      {followup && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="card alert-info" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <ShieldLockIcon size={16} style={{ color: "var(--accent)" }} />
              <span>
                <strong>Adaptive Follow-up:</strong> The jury is interrogating your specific phrasing. Defend your answer within {followup.time_limit_seconds}s.
              </span>
            </div>
          </div>

          <QuestionCard
            question={{ id: followup.followup.id, question: followup.followup.question }}
            answer={followupAnswer}
            timeLimit={followup.time_limit_seconds}
            onTick={(id, s) => (timeLeft.current[id] = s)}
            onExpire={markExpired}
            onAnswerChange={(_, val) => setFollowupAnswer(val)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
            <button className="btn btn-primary" onClick={handleFollowUp} disabled={loading}>
              {loading ? "Grading and verifying..." : "Submit Follow-up Defense"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Final Outcome */}
      {result && (
        <PostingResult
          result={result}
          onRetry={reset}
          onViewJobs={onViewJobs}
        />
      )}
    </div>
  );
}

