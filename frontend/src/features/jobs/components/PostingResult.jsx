import React from "react";
import { CheckCircleIcon, ShieldLockIcon, JobsIcon } from "../../../shared/components/Icons";

/**
 * The outcome of a company quiz.
 *
 * Same invariant as ScoreResult: the number is never shown alone. A posting that
 * failed has to say what it failed on, because the point of the gate is to send
 * the company back to rewrite the posting — not to score them and leave.
 */
export default function PostingResult({ result, onRetry, onViewJobs }) {
  const feedback = Array.isArray(result?.feedback) ? result.feedback : [];
  const passed = Boolean(result?.passed);
  const score = Math.round(result?.score ?? 0);
  const passScore = result?.pass_score ?? 70;

  return (
    <div className="card" style={{ padding: "32px 24px" }}>
      {/* Top Banner */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        {passed ? (
          <CheckCircleIcon size={44} style={{ color: "var(--success)", marginBottom: "10px" }} />
        ) : (
          <ShieldLockIcon size={44} style={{ color: "var(--danger)", marginBottom: "10px" }} />
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "6px" }}>
          <span className={`badge ${passed ? "badge-success" : "badge-cream"}`}>
            {passed ? "Gate Passed — Role Published" : `Gate Failed (Bar: ${passScore}/100)`}
          </span>
        </div>

        <h2 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-main)", marginBottom: "6px" }}>
          Role Verification Score: {score} / 100
        </h2>

        <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "560px", margin: "0 auto", lineHeight: "1.5" }}>
          {passed
            ? "Your technical defense verified that this posting reflects real architectural expectations. The role is now live and candidates can apply with their comprehension profiles."
            : `Your defense scored ${score}/100, which is below the publication threshold of ${passScore}/100. Nothing was published — update your posting so it accurately reflects the real role, and run verification again.`}
        </p>
      </div>

      {/* Per-question Jury Breakdown */}
      <div style={{ borderTop: "1px solid var(--mist-border-light)", paddingTop: "20px", marginTop: "10px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--text-main)" }}>
          Architectural Jury Feedback & Notes
        </h3>

        {feedback.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {feedback.map((f, i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface-sunken)",
                  border: "1px solid var(--mist-border-light)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px", gap: "10px" }}>
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-main)" }}>
                    {f.question}
                  </p>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: f.score >= 7 ? "var(--success-bg)" : "var(--cream-bg)",
                      color: f.score >= 7 ? "var(--success-text)" : "var(--cream-text)",
                      fontWeight: "700",
                      flexShrink: 0,
                    }}
                  >
                    {f.score} / 10
                  </span>
                </div>
                {f.note && (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    {f.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            No detailed breakdown was recorded for this verification attempt.
          </p>
        )}
      </div>

      {/* Bottom Actions */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "24px", flexWrap: "wrap" }}>
        {passed && onViewJobs && (
          <button className="btn btn-primary" onClick={onViewJobs}>
            <JobsIcon size={14} />
            <span>View Published Roles</span>
          </button>
        )}

        {(!passed || onRetry) && (
          <button className={`btn ${passed ? "btn-secondary" : "btn-primary"}`} onClick={onRetry}>
            <span>{passed ? "Post Another Role" : "Rewrite Posting & Retry Verification"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

