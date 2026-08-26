import { useEffect, useRef, useState } from "react";
import { createInputTracker } from "../pasteDetect";
import {
  ClockIcon,
  FileCodeIcon,
  PlusIcon,
  ShieldLockIcon,
  SparklesIcon,
} from "../../../shared/components/Icons";

export default function BugHuntWorkspace({
  challenge,
  onSubmit,
  busy,
}) {
  const {
    bug_hunt_id,
    repo_url,
    modified_files = [],
    time_limit_seconds = 180,
    expected_bug_count = 3,
  } = challenge;

  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(time_limit_seconds);

  // Candidate findings list
  const [findings, setFindings] = useState([
    {
      id: "finding_1",
      file_path: modified_files[0]?.path || "",
      suspected_location: "",
      description: "",
    },
  ]);

  // Input tracker per finding
  const trackersRef = useRef(new Map());

  function getTracker(findingId) {
    if (!trackersRef.current.has(findingId)) {
      trackersRef.current.set(findingId, createInputTracker());
    }
    return trackersRef.current.get(findingId);
  }

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      handleFinalSubmit();
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  function handleAddFinding() {
    const nextId = "finding_" + (findings.length + 1) + "_" + Date.now();
    setFindings((prev) => [
      ...prev,
      {
        id: nextId,
        file_path: modified_files[activeFileIndex]?.path || modified_files[0]?.path || "",
        suspected_location: "",
        description: "",
      },
    ]);
  }

  function handleRemoveFinding(id) {
    if (findings.length <= 1) return;
    setFindings((prev) => prev.filter((f) => f.id !== id));
  }

  function handleUpdateFinding(id, field, value) {
    setFindings((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        if (field === "description") {
          const tracker = getTracker(id);
          tracker.record(f.description, value, Date.now());
        }
        return { ...f, [field]: value };
      })
    );
  }

  function handleFinalSubmit(e) {
    e?.preventDefault();
    if (busy) return;

    // Filter valid findings with description
    const formattedFindings = findings
      .filter((f) => f.description.trim().length > 0)
      .map((f) => {
        const tracker = getTracker(f.id);
        const snapshot = tracker.snapshot();
        return {
          file_path: f.file_path || modified_files[0]?.path || "source_file",
          suspected_location: f.suspected_location.trim() || null,
          description: f.description.trim(),
          seconds_left: secondsLeft,
          flagged_paste: snapshot.flagged_paste,
          paste_delta: snapshot.paste_delta,
        };
      });

    onSubmit(formattedFindings);
  }

  const activeFile = modified_files[activeFileIndex] || modified_files[0] || { path: "file.py", content: "" };
  const lines = (activeFile.content || "").split("\n");

  const progressPercent = Math.max(0, (secondsLeft / time_limit_seconds) * 100);
  const isUrgent = secondsLeft < 30;

  const validFindingsCount = findings.filter((f) => f.description.trim().length > 0).length;

  return (
    <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Timer Bar */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>
                Bug Hunt Challenge
              </h2>
              <span className="badge badge-accent">
                ~{expected_bug_count} Injected Bugs
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
              We injected subtle logic bugs into your code. Inspect the source below and report every bug you find.
            </p>
          </div>

          {/* Timer Clock */}
          <div
            className={`badge ${isUrgent ? "badge-danger" : "badge-accent"}`}
            style={{
              fontSize: "14px",
              padding: "6px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: "700",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <ClockIcon size={16} />
            <span>
              {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Timer Progress Bar */}
        <div
          style={{
            height: "4px",
            background: "var(--mist-border-light)",
            borderRadius: "2px",
            overflow: "hidden",
            width: "100%",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: isUrgent ? "var(--error)" : "var(--accent)",
              transition: "width 1s linear, background-color 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Main Grid: Code Viewer & Findings Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "18px" }}>
        {/* LEFT: Modified Code Block Viewer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* File Selector Tabs */}
          {modified_files.length > 1 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {modified_files.map((file, idx) => (
                <button
                  key={file.path}
                  type="button"
                  className={`btn btn-sm ${activeFileIndex === idx ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveFileIndex(idx)}
                  style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}
                >
                  <FileCodeIcon size={13} />
                  <span>{file.path.split("/").pop()}</span>
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              border: "1px solid var(--mist-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--navy-sunken)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "8px 14px",
                borderBottom: "1px solid var(--mist-border-light)",
                background: "rgba(0, 0, 0, 0.2)",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{activeFile.path}</span>
              <span>{lines.length} lines</span>
            </div>

            <div
              style={{
                maxHeight: "520px",
                overflowY: "auto",
                padding: "12px 0",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                lineHeight: "1.6",
                color: "var(--text-main)",
              }}
            >
              {lines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    padding: "0 14px",
                    userSelect: "text",
                  }}
                >
                  <span
                    style={{
                      width: "36px",
                      flexShrink: 0,
                      color: "var(--text-dim)",
                      textAlign: "right",
                      paddingRight: "14px",
                      userSelect: "none",
                    }}
                  >
                    {i + 1}
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: "inherit",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {line || " "}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Candidate Bug Findings Form */}
        <form onSubmit={handleFinalSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: 0, color: "var(--text-main)" }}>
              Reported Findings ({validFindingsCount})
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddFinding}
            >
              <PlusIcon size={13} />
              <span>Add Finding</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "460px", overflowY: "auto", paddingRight: "4px" }}>
            {findings.map((finding, idx) => (
              <div
                key={finding.id}
                style={{
                  border: "1px solid var(--mist-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px",
                  background: "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent)" }}>
                    Suspected Bug #{idx + 1}
                  </span>
                  {findings.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRemoveFinding(finding.id)}
                      style={{ fontSize: "11px", color: "var(--text-dim)", padding: "2px 6px" }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>File</label>
                    <select
                      className="select-field"
                      style={{ fontSize: "12px", padding: "6px 8px" }}
                      value={finding.file_path}
                      onChange={(e) => handleUpdateFinding(finding.id, "file_path", e.target.value)}
                    >
                      {modified_files.map((f) => (
                        <option key={f.path} value={f.path}>
                          {f.path.split("/").pop()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Location Hint</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Line 42 or calculateTotal"
                      style={{ fontSize: "12px", padding: "6px 8px" }}
                      value={finding.suspected_location}
                      onChange={(e) => handleUpdateFinding(finding.id, "suspected_location", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "11px" }}>
                    What is wrong and what will fail?
                  </label>
                  <textarea
                    className="textarea-field"
                    placeholder="Explain what the bug is, why it is wrong, and what consequence it causes..."
                    rows={3}
                    style={{ fontSize: "12px", minHeight: "75px" }}
                    value={finding.description}
                    onChange={(e) => handleUpdateFinding(finding.id, "description", e.target.value)}
                    required={idx === 0}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={busy || validFindingsCount === 0}
            style={{ width: "100%", marginTop: "auto" }}
          >
            {busy ? "Evaluating Findings..." : `Submit Findings for Grading (${validFindingsCount})`}
          </button>
        </form>
      </div>
    </div>
  );
}
