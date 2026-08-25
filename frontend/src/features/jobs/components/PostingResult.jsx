/**
 * The outcome of a company quiz.
 *
 * Same invariant as ScoreResult: the number is never shown alone. A posting that
 * failed has to say what it failed on, because the point of the gate is to send
 * the company back to rewrite the posting — not to score them and leave.
 */
import { CheckCircleIcon, ShieldLockIcon } from "../../../shared/components/Icons";

export default function PostingResult({ result, onRetry }) {
  const feedback = Array.isArray(result?.feedback) ? result.feedback : [];
  const score = Math.round(result?.score ?? 0);
  const passed = Boolean(result?.passed);

  return (
    <div className="result-container">
      <div className="result-hero-card">
        <div className="score-gauge-wrap">
          <div
            className="score-circle"
            style={{ borderColor: passed ? "var(--success)" : "var(--accent)" }}
          >
            <span className="score-num">{score}</span>
            <span className="score-max">/ 100</span>
          </div>
        </div>

        <div className="result-hero-info">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span className={`badge ${passed ? "badge-success" : "badge-accent"}`}>
              {passed ? (
                <>
                  <CheckCircleIcon size={11} />
                  Published
                </>
              ) : (
                <>
                  <ShieldLockIcon size={11} />
                  Not published
                </>
              )}
            </span>
            <span className="badge badge-cream">
              Bar: {result?.pass_score ?? 70}/100
            </span>
          </div>

          <h2 className="result-headline">Posting accuracy: {score}/100</h2>

          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
            {passed
              ? "Your posting is live. Candidates see it alongside the fact that you answered for it."
              : `The bar is ${result?.pass_score ?? 70}/100. Nothing was published — rewrite the posting so it describes the role you just described, and run it again.`}
          </p>

          {!passed && onRetry && (
            <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={onRetry}>
                <span>Edit the posting and try again</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-main)" }}>
            Per-Question Grading Breakdown
          </h3>
          <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
            Defended Evaluation Matrix
          </span>
        </div>

        {feedback.length > 0 ? (
          <div className="feedback-list">
            {feedback.map((f, i) => (
              <div key={i} className="feedback-card">
                <div className="feedback-header-row">
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>
                    {f.question}
                  </span>
                  <span className="feedback-score-pill">{f.score} / 10</span>
                </div>
                <p className="feedback-note">{f.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: "24px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              No per-question breakdown was returned for this attempt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
