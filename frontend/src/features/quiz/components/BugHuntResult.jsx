import {
  CheckCircleIcon,
  ShieldLockIcon,
  ReputationIcon,
  SparklesIcon,
  FileCodeIcon,
} from "../../../shared/components/Icons";

export default function BugHuntResult({ result, onRestart, onNavigateReputation }) {
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
    <div className="card" style={{ padding: "28px", textAlign: "center", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner */}
      <div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "50%",
              background: isHighPass ? "var(--accent-soft)" : "var(--card-bg-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isHighPass ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${isHighPass ? "var(--accent)" : "var(--mist-border)"}`,
            }}
          >
            {isHighPass ? <CheckCircleIcon size={28} /> : <ShieldLockIcon size={28} />}
          </div>
        </div>

        <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "4px" }}>
          Bug Hunt Evaluation Complete
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "480px", margin: "0 auto" }}>
          {summary || "Your debugging findings have been evaluated against the server-side ground truth injected bugs."}
        </p>
      </div>

      {/* Score and Stats Gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", maxWidth: "460px", margin: "0 auto", width: "100%" }}>
        <div
          style={{
            background: "var(--navy-sunken)",
            border: "1px solid var(--mist-border-light)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-subtle)", fontWeight: "600" }}>
            Bug Hunt Score
          </span>
          <div style={{ fontSize: "36px", fontWeight: "800", color: isHighPass ? "var(--accent)" : "var(--text-main)", margin: "4px 0" }}>
            {roundedScore}
            <span style={{ fontSize: "16px", fontWeight: "500", color: "var(--text-subtle)" }}> / 100</span>
          </div>
          <span className={`badge ${isHighPass ? "badge-accent" : "badge-cream"}`}>
            {isHighPass ? "High Comprehension" : "Partial Detection"}
          </span>
        </div>

        <div
          style={{
            background: "var(--navy-sunken)",
            border: "1px solid var(--mist-border-light)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-subtle)", fontWeight: "600" }}>
            Injected Bugs Caught
          </span>
          <div style={{ fontSize: "36px", fontWeight: "800", color: bugs_caught === total_bugs ? "var(--success)" : "var(--accent)", margin: "4px 0" }}>
            {bugs_caught}
            <span style={{ fontSize: "16px", fontWeight: "500", color: "var(--text-subtle)" }}> / {total_bugs}</span>
          </div>
          <span className="badge badge-secondary">
            {bugs_caught === total_bugs ? "All Bugs Caught" : `${total_bugs - bugs_caught} Missed`}
          </span>
        </div>
      </div>

      {/* Breakdown per Injected Bug */}
      <div style={{ textAlign: "left" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--text-main)" }}>
          Injected Bug Breakdown & Feedback
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {breakdown.map((item, idx) => {
            const caught = Boolean(item.caught);
            const quality = item.explanation_quality || (caught ? "good" : "missed");

            return (
              <div
                key={idx}
                style={{
                  border: "1px solid var(--mist-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  background: "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: caught ? "var(--success)" : "var(--error)",
                      }}
                    >
                      {caught ? <CheckCircleIcon size={14} /> : <ShieldLockIcon size={14} />}
                      {caught ? "Bug Caught" : "Bug Missed"}
                    </span>
                    {item.file_path && (
                      <span className="badge badge-secondary" style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
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
                        : "badge-secondary"
                    }`}
                    style={{ textTransform: "capitalize", fontSize: "11px" }}
                  >
                    Explanation: {quality}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: "500", marginTop: "2px" }}>
                  {item.description}
                </div>

                {item.feedback && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", lineHeight: "1.4" }}>
                    <strong>Feedback:</strong> {item.feedback}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "8px" }}>
        <button className="btn btn-primary" onClick={onRestart}>
          <span>Try Another Repo / Challenge</span>
        </button>
        {onNavigateReputation && (
          <button className="btn btn-secondary" onClick={onNavigateReputation}>
            <ReputationIcon size={14} />
            <span>View Reputation</span>
          </button>
        )}
      </div>
    </div>
  );
}
