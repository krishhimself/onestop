import { useEffect, useRef, useState } from "react";
import JobDraftForm from "./components/JobDraftForm";
import PostingResult from "./components/PostingResult";
// The timed, paste-recording question card is shared with the candidate quiz on
// purpose: both sides of the market must run under the same clock and the same
// silent paste detection, and two copies would drift. If a third feature needs it,
// move it to shared/components rather than copying it again.
import QuestionCard from "../quiz/components/QuestionCard";
import {
  generateCompanyQuiz,
  submitCompanyFollowUp,
  submitCompanyQuiz,
} from "./api";

const EMPTY_DRAFT = { company_name: "", role_title: "", description: "", tech_stack: "" };

export default function PostJobPage({ onUnauthorized }) {
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
      setResult(
        await submitCompanyFollowUp(quiz.quiz_id, followupAnswer, timeLeft.current[id] ?? null)
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

  const drafting = !quiz && !result;

  return (
    <div className="container">
      <h1>Post a Job</h1>
      <p className="tagline">
        Write the posting, then answer for it. Postings go live only if they describe a
        role you can actually account for.
      </p>

      {drafting && (
        <JobDraftForm
          draft={draft}
          onChange={setDraft}
          onSubmit={handleGenerate}
          loading={loading}
        />
      )}

      {error && <p className="error">{error}</p>}

      {quiz && !followup && !result && (
        <div className="quiz">
          <p className="rules">
            {limit}s per question · answers lock when the timer runs out · your draft is
            held until this is graded
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

      {result && <PostingResult result={result} onRetry={reset} />}
    </div>
  );
}
