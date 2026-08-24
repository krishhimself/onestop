import { useEffect, useRef, useState } from "react";
import { createInputTracker } from "../pasteDetect";
import { ClockIcon, FileCodeIcon } from "../../../shared/components/Icons";

/**
 * One timed question.
 *
 * The countdown starts when the card mounts and is derived from wall-clock time
 * rather than accumulated ticks, so a backgrounded tab cannot buy extra seconds by
 * having its timers throttled. On expiry the answer is committed as-is — blank
 * included — and the box locks.
 *
 * Paste is deliberately NOT blocked. It is recorded instead: a single change event
 * that adds a paragraph is reported upward as flagged_paste. The candidate sees no
 * warning and nothing is prevented, so a paste still looks to them like it worked.
 * The flag decides which answer gets pushed on in the follow-up round.
 */
export default function QuestionCard({
  question,
  answer,
  onAnswerChange,
  onExpire,
  onTick,
  onInputSignal,
  timeLimit = 75,
  questionNumber,
  totalQuestions,
}) {
  const [left, setLeft] = useState(timeLimit);
  const [isFocused, setIsFocused] = useState(false);
  const tracker = useRef(null);
  if (tracker.current === null) tracker.current = createInputTracker();
  const cbs = useRef({ onExpire, onTick });
  cbs.current = { onExpire, onTick };

  useEffect(() => {
    const startedAt = Date.now();
    let done = false;
    const tick = () => {
      const remaining = Math.max(
        0,
        timeLimit - Math.floor((Date.now() - startedAt) / 1000)
      );
      setLeft(remaining);
      cbs.current.onTick?.(question.id, remaining);
      if (remaining === 0 && !done) {
        done = true;
        clearInterval(handle);
        cbs.current.onExpire?.(question.id);
      }
    };
    const handle = setInterval(tick, 250);
    tick();
    return () => clearInterval(handle);
  }, [question.id, timeLimit]);

  function handleChange(e) {
    const next = e.target.value;
    tracker.current.record(answer || "", next, Date.now());
    onInputSignal?.(question.id, tracker.current.snapshot());
    onAnswerChange(question.id, next);
  }

  const locked = left === 0;
  const isUrgent = left <= 10 && !locked;
  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, "0");
  const charCount = (answer || "").length;

  return (
    <div className={`question-card ${locked ? "locked" : ""} ${isFocused && !locked ? "active-focus" : ""}`}>
      {/* Top Meta Bar */}
      <div className="question-top-row">
        <div className="question-meta-group">
          {questionNumber && (
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent-text)" }}>
              Question {questionNumber} of {totalQuestions || 4}
            </span>
          )}

          {question.category && (
            <span className="badge badge-cream">
              {question.category}
            </span>
          )}

          {question.file_reference && (
            <span className="file-ref-pill" title={question.file_reference}>
              <FileCodeIcon size={13} />
              <span>{question.file_reference}</span>
            </span>
          )}
        </div>

        {/* High-visibility Countdown Timer */}
        <div className={`timer-pill ${isUrgent ? "urgent" : ""}`}>
          <ClockIcon size={14} />
          <span>{locked ? "Locked (Time Up)" : `${mins}:${secs}`}</span>
        </div>
      </div>

      {/* Question Prompt */}
      <h3 className="question-prompt">
        {question.question}
      </h3>

      {/* Answer Area */}
      <div className="question-textarea-wrap">
        <textarea
          className="question-textarea"
          value={answer || ""}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={locked}
          placeholder={
            locked
              ? "Time expired — your answer has been locked and recorded."
              : "Explain your reasoning in your own words. Focus on how the logic works and why design choices were made..."
          }
        />
        <span className="char-counter">{charCount} characters</span>
      </div>
    </div>
  );
}
