import React from "react";
import { GitHubIcon } from "../../../shared/components/Icons";

const DEMO_REPOS = [
  { label: "psf/requests", url: "https://github.com/psf/requests" },
  { label: "pallets/flask", url: "https://github.com/pallets/flask" },
  { label: "fastapi/fastapi", url: "https://github.com/fastapi/fastapi" },
  { label: "expressjs/express", url: "https://github.com/expressjs/express" },
];

export default function RepoInput({
  value,
  onChange,
  onSubmit,
  loading,
  title = "Analyze Public Repository",
  description = "Enter any public GitHub repository URL. The system extracts representative source files and generates evaluation questions.",
  submitLabel = "Generate Quiz",
  loadingLabel = "Analyzing Repo...",
}) {
  return (
    <div className="repo-input-card">
      <div style={{ marginBottom: "6px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>
          {title}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "600px", lineHeight: "1.5" }}>
          {description}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value && !loading) onSubmit();
        }}
        className="repo-input-form"
      >
        <div style={{ position: "relative", flex: 1 }}>
          <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", display: "flex", alignItems: "center" }}>
            <GitHubIcon size={18} />
          </div>
          <input
            type="url"
            className="input-field"
            style={{ paddingLeft: "38px" }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://github.com/username/repository"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !value}
          style={{ minWidth: "140px" }}
        >
          {loading ? loadingLabel : submitLabel}
        </button>
      </form>

      {/* Quick Demo Repositories */}
      <div className="repo-chips-row">
        <span className="repo-chip-label">Sample repositories:</span>
        {DEMO_REPOS.map((r) => (
          <button
            key={r.url}
            type="button"
            className="repo-chip"
            onClick={() => onChange(r.url)}
            disabled={loading}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
