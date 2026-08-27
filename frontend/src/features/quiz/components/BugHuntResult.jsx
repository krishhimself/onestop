import React from "react";
import {
  CheckCircleIcon,
  ShieldLockIcon,
  ReputationIcon,
  FileCodeIcon,
} from "../../../shared/components/Icons";

export default function BugHuntResult({
  result,
  onRestart,
  onNavigateReputation,
}) {
  const {
    score = 0,
    bugs_caught = 0,
    total_bugs = 0,
    breakdown = [],
    summary = "",
  } = result;

  const roundedScore = Math.round(score);
  const isHighPass = roundedScore >= 70;

  return (
    <div
      className="card"
      style={{
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Top Banner */}
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: isHighPass ? "var(--success-bg)" : "var(--surface-sunken)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isHighPass ? "var(--success)" : "var(--text-muted)",
              border: `2px solid ${isHighPass ? "var(--success)" : "var(--mist-border)"}`,
            }}
          >
            {isHighPass ? <CheckCircleIcon size={30} /> : <ShieldLockIcon size={30} />}
          </div>
        </div>

        <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px", color: "var(--text-main)" }}>
          Bug Hunt Evaluation Complete
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            maxWidth: "520px",
            margin: "0 auto",
            lineHeight: "1.5",
          }}
        >
          {summary ||
            "Your debugging findings have been evaluated against the server-side ground truth injected bugs."}
        </p>
      </div>

      {/* Score and Detection Gauges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          maxWidth: "480px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--mist-border-light)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--text-subtle)",
              fontWeight: "600",
            }}
          >
            Bug Hunt Score
          </span>
          <div
            style={{
              fontSize: "36px",
              fontWeight: "800",
              color: isHighPass ? "var(--accent)" : "var(--text-main)",
              margin: "4px 0",
            }}
          >
            {roundedScore}
            <span style={{ fontSize: "16px", fontWeight: "500", color: "var(--text-subtle)" }}> / 100</span>
          </div>
          <span className={`badge ${isHighPass ? "badge-success" : "badge-cream"}`}>
            {isHighPass ? "High Comprehension (70+)" : "Partial Detection"}
          </span>
        </div>

        <div
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--mist-border-light)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--text-subtle)",
              fontWeight: "600",
            }}
          >
            Injected Bugs Caught
          </span>
          <div
            style={{
              fontSize: "36px",
              fontWeight: "800",
              color: bugs_caught === total_bugs ? "var(--success)" : "var(--accent)",
              margin: "4px 0",
            }}
          >
            {bugs_caught}
            <span style={{ fontSize: "16px", fontWeight: "500", color: "var(--text-subtle)" }}>
              {" "}
              / {total_bugs}
            </span>
          </div>
          <span className="badge badge-mist">
            {bugs_caught === total_bugs
              ? "All Injected Bugs Caught"
              : `${total_bugs - bugs_caught} Missed`}
          </span>
        </div>
      </div>

      {/* Breakdown per Injected Bug */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>
            Injected Bug Breakdown & Feedback
          </h3>
          <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
            Server-Side Ground Truth Comparison
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {breakdown.map((item, idx) => {
            const caught = Boolean(item.caught);
            const quality = item.explanation_quality || (caught ? "good" : "missed");

            return (
              <div
                key={idx}
                style={{
                  border: `1px solid ${caught ? "var(--mist-border)" : "var(--danger-border)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  background: caught ? "var(--surface)" : "rgba(220, 38, 38, 0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: caught ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {caught ? <CheckCircleIcon size={14} /> : <ShieldLockIcon size={14} />}
                      {caught ? "Bug Caught" : "Bug Missed"}
                    </span>

                    {item.file_path && (
                      <span
                        className="badge badge-mist"
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
                      >
                        <FileCodeIcon size={11} />
                        {item.file_path}
                      </span>
                    )}
                  </div>

                  <span
                    className={`badge ${
                      quality === "excellent"
                        ? "badge-success"
                        : quality === "good"
                        ? "badge-accent"
                        : quality === "partial"
                        ? "badge-cream"
                        : "badge-danger"
                    }`}
                    style={{ textTransform: "capitalize", fontSize: "11px" }}
                  >
                    Explanation Quality: {quality}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-main)",
                    fontWeight: "600",
                  }}
                >
                  {item.description}
                </div>

                {item.feedback && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      lineHeight: "1.5",
                      background: "var(--surface-sunken)",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <strong style={{ color: "var(--text-main)" }}>Evaluator Note: </strong>
                    {item.feedback}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          marginTop: "6px",
          flexWrap: "wrap",
        }}
      >
        {onRestart && (
          <button className="btn btn-primary" onClick={onRestart}>
            <span>Test Another Challenge</span>
          </button>
        )}

        {onNavigateReputation && (
          <button className="btn btn-secondary" onClick={onNavigateReputation}>
            <ReputationIcon size={14} />
            <span>View Full Reputation</span>
          </button>
        )}
      </div>
    </div>
  );
}
