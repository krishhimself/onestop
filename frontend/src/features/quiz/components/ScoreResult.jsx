import React from "react";
import { FileCodeIcon, ReputationIcon } from "../../../shared/components/Icons";

export default function ScoreResult({
  result,
  complexity,
  onReset,
  onViewReputation,
  isDay1 = false,
  day1Job = null,
  onCompleteDay1 = null,
}) {
  const tier = complexity?.tier;
  const tierLabel = !tier ? null : tier === "unknown" ? "unrated" : tier;
  const feedback = Array.isArray(result?.feedback) ? result.feedback : [];
  const score = Math.round(result?.score ?? 0);
  const isPassed = score >= 70;

  return (
    <div className="result-container">
      {/* Result Hero Card */}
      <div className="result-hero-card">
        <div className="score-gauge-wrap">
          <div
            className="score-circle"
            style={{
              borderColor: isPassed ? "var(--success)" : "var(--accent)",
            }}
          >
            <span className="score-num">{score}</span>
            <span className="score-max">/ 100</span>
          </div>
        </div>

        <div className="result-hero-info">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span className={`badge ${isPassed ? "badge-success" : "badge-accent"}`}>
              {isPassed ? "Threshold Cleared (70+)" : "Attempt Evaluated"}
            </span>

            {tierLabel && (
              <span className="badge badge-cream">
                Complexity: {tierLabel}
              </span>
            )}
          </div>

          <h2 className="result-headline">
            {isDay1
              ? `Day-1 Readiness Score: ${score}/100`
              : isPassed
              ? "Comprehension Verified"
              : "Quiz Evaluation Complete"}
          </h2>

          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
            {isDay1
              ? `Your orientation speed and architectural understanding on ${day1Job?.role_title || "this role"}'s trial repository has been graded. This Day-1 score is attached directly to your application.`
              : isPassed
              ? "Your explanations and defense demonstrated genuine code comprehension. Your profile now reveals your identity to employers."
              : "The evaluation grades your original reasoning together with how well you defended the adaptive follow-up question."}
          </p>

          {/* Complexity Reasoning Card */}
          {complexity?.reasoning && (
            <div className="complexity-card">
              <div className="complexity-header">
                <FileCodeIcon size={13} style={{ color: "var(--text-subtle)" }} />
                <strong style={{ fontSize: "12px", color: "var(--text-main)" }}>
                  Project Complexity Assessment ({tierLabel}):
                </strong>
              </div>
              <p className="complexity-reasoning">{complexity.reasoning}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
            {onCompleteDay1 && (
              <button className="btn btn-primary" onClick={onCompleteDay1}>
                <span>Submit Application with Day-1 Score</span>
              </button>
            )}

            {onViewReputation && (
              <button className="btn btn-secondary" onClick={onViewReputation}>
                <ReputationIcon size={14} />
                <span>View Full Reputation Profile</span>
              </button>
            )}

            {onReset && (
              <button className="btn btn-secondary" onClick={onReset}>
                <span>{isDay1 ? "Close" : "Test Another Repository"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Per-question Detailed Breakdown */}
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
            {feedback.map((f, idx) => (
              <div key={idx} className="feedback-card">
                <div className="feedback-header-row">
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>
                    {f.question}
                  </span>
                  <span className="feedback-score-pill">
                    {f.score} / 10
                  </span>
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
