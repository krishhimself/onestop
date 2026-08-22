import { useEffect, useRef, useState } from "react";
import { createInputTracker } from "../pasteDetect";

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
}) {
  const [left, setLeft] = useState(timeLimit);
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
  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, "0");

  return (
    <div className={`question${locked ? " locked" : ""}`}>
      <p>
        <strong>{question.question}</strong>
        {question.file_reference && <span className="ref"> ({question.file_reference})</span>}
      </p>

      <div className="meta">
        {question.category && <span className="cat">{question.category}</span>}
        <span className={`timer${left <= 10 ? " urgent" : ""}`}>
          {locked ? "time up" : `${mins}:${secs}`}
        </span>
      </div>

      <textarea
        value={answer || ""}
        onChange={handleChange}
        disabled={locked}
        placeholder={locked ? "Locked — time expired." : "Your answer..."}
      />
    </div>
  );
}
