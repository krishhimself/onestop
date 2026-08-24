/**
 * The outcome of a company quiz.
 *
 * Same invariant as ScoreResult: the number is never shown alone. A posting that
 * failed has to say what it failed on, because the point of the gate is to send
 * the company back to rewrite the posting — not to score them and leave.
 */
export default function PostingResult({ result, onRetry }) {
  const feedback = Array.isArray(result?.feedback) ? result.feedback : [];

  return (
    <div className="result">
      <h2 className="headline">
        Posting accuracy: {result.score}/100
        <span className={`verdict ${result.passed ? "pass" : "fail"}`}>
          {result.passed ? "published" : "not published"}
        </span>
      </h2>

      <p className="complexity-why">
        {result.passed
          ? "Your posting is live. Candidates see it alongside the fact that you answered for it."
          : `The bar is ${result.pass_score}/100. Nothing was published — rewrite the posting so it describes the role you just described, and run it again.`}
      </p>

      {feedback.length > 0 ? (
        feedback.map((f, i) => (
          <div key={i} className="feedback-item">
            <p className="q">{f.question}</p>
            <p className="s">
              {f.score}/10 — {f.note}
            </p>
          </div>
        ))
      ) : (
        <p className="s">No per-question breakdown was returned for this attempt.</p>
      )}

      {!result.passed && (
        <button onClick={onRetry}>Edit the posting and try again</button>
      )}
    </div>
  );
}
