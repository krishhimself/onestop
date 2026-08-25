import { useEffect, useRef, useState } from "react";
import JobDraftForm from "./components/JobDraftForm";
import PostingResult from "./components/PostingResult";
// The timed, paste-recording question card is shared with the candidate quiz on
// purpose: both sides of the market must run under the same clock and the same
// silent paste detection, and two copies would drift. If a third feature needs it,
// move it to shared/components rather than copying it again.
import QuestionCard from "../quiz/components/QuestionCard";
import { ClockIcon } from "../../shared/components/Icons";
import {
  generateCompanyQuiz,
  submitCompanyFollowUp,
  submitCompanyQuiz,
} from "./api";

const EMPTY_DRAFT = { company_name: "", role_title: "", description: "", tech_stack: "" };

export default function PostJobPage({ onUnauthorized, onPublished, onCancel }) {
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
      // The stack is typed as one line and split here; the backend stores the list
      // it was given and asks which of those the hire actually touches.
      const data = await generateCompanyQuiz({
        company_name: draft.company_name.trim(),
        role_title: draft.role_title.trim(),
        description: draft.description.trim(),
        tech_stack: draft.tech_stack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setQuiz(data);
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
      setFollowup(await submitCompanyQuiz(quiz.quiz_id, payload));
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
      const graded = await submitCompanyFollowUp(
        quiz.quiz_id,
        followupAnswer,
        timeLeft.current[id] ?? null
      );
      setResult(graded);
      // Only a pass created a posting, so only a pass changes the listings.
      if (graded?.passed) onPublished?.();
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

  const drafting = !quiz && !result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {drafting && (
        <>
          <JobDraftForm
            draft={draft}
            onChange={setDraft}
            onSubmit={handleGenerate}
            loading={loading}
          />
          {onCancel && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {quiz && !followup && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="quiz-header-bar">
            <div className="quiz-rules-pill">
              <ClockIcon size={14} style={{ color: "var(--text-subtle)" }} />
              <span>
                <strong>{limit}s per question</strong> · Your draft is held until this is
                graded
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="badge badge-mist">{quiz.questions.length} Questions</span>
              <span className="badge badge-cream">{quiz.role_title}</span>
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
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting Answers..." : "Submit Round for Defense"}
            </button>
          </div>
        </div>
      )}

      {followup && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="followup-card">
            <div className="followup-badge-callout">
              <span className="badge badge-accent">Adaptive Defense Round</span>
              <span className="badge badge-mist">
                {followup.time_limit_seconds}s Clock
              </span>
            </div>

            <h2 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>
              Defend Your Posting
            </h2>

            <p className="followup-explanation">
              One follow-up on wording you just used about this role. Nothing is graded
              and nothing publishes until this is answered.
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
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-lg" onClick={handleFollowUp} disabled={loading}>
              {loading ? "Grading..." : "Submit Follow-up"}
            </button>
          </div>
        </div>
      )}

      {result && <PostingResult result={result} onRetry={reset} />}
    </div>
  );
}
