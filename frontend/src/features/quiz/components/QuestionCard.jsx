import { useEffect, useRef, useState } from "react";

/**
 * One timed question.
 *
 * The countdown starts when the card mounts and is derived from wall-clock time
 * rather than accumulated ticks, so a backgrounded tab cannot buy extra seconds by
 * having its timers throttled. On expiry the answer is committed as-is — blank
 * included — and the box locks.
 *
 * Paste is blocked so the answer has to be typed. This is a speed bump, not a
 * security control: it stops the casual paste from another tab, and the real
 * signal is the typing pace reported via onTick.
 */
export default function QuestionCard({
  question,
  answer,
  onAnswerChange,
  onExpire,
  onTick,
  timeLimit = 75,
}) {
  const [left, setLeft] = useState(timeLimit);
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

  const locked = left === 0;
  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, "0");

  const block = (e) => e.preventDefault();

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
        onChange={(e) => onAnswerChange(question.id, e.target.value)}
        onPaste={block}
        onDrop={block}
        disabled={locked}
        placeholder={locked ? "Locked — time expired." : "Your answer... (typing only, no paste)"}
      />
    </div>
  );
}
