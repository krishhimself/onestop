import React from "react";
import { ShieldLockIcon, FileCodeIcon, CheckCircleIcon } from "../../../shared/components/Icons";

/**
 * The draft posting form.
 *
 * This is the last point at which the posting can be edited. Once the quiz is
 * generated the backend holds this draft and publishes that copy on a pass, so
 * the posting that goes live is the one the questions were written about.
 */
export default function JobDraftForm({ draft, onChange, onSubmit, loading, onCancel }) {
  const set = (field) => (e) => onChange({ ...draft, [field]: e.target.value });

  const ready =
    draft.company_name.trim() && draft.role_title.trim() && draft.description.trim();

  return (
    <div className="card" style={{ padding: "28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div className="badge badge-accent" style={{ marginBottom: "8px" }}>
            <ShieldLockIcon size={12} />
            Step 1: Compose Draft Role
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>
            Draft Verified Job Posting
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
            Write what the job actually is. The platform will immediately generate an architectural jury audit against this draft before publishing.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="job-company">
              Company Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="job-company"
              className="input-field"
              value={draft.company_name}
              onChange={set("company_name")}
              placeholder="e.g. Stripe, Acme Corp, Basecamp"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="job-role">
              Role Title <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="job-role"
              className="input-field"
              value={draft.role_title}
              onChange={set("role_title")}
              placeholder="e.g. Senior Distributed Systems Engineer"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="job-tech-stack">
            Primary Tech Stack (comma-separated)
          </label>
          <input
            id="job-tech-stack"
            className="input-field"
            value={draft.tech_stack}
            onChange={set("tech_stack")}
            placeholder="e.g. Python, FastAPI, PostgreSQL, Redis, Kubernetes, Docker"
          />
          <span style={{ fontSize: "11px", color: "var(--text-subtle)", marginTop: "4px", display: "block" }}>
            The quiz will ask which of these specific technologies the hire actually writes code in vs legacy infrastructure.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="job-trial-repo">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FileCodeIcon size={14} style={{ color: "var(--accent)" }} />
              <span>Day-1 Readiness Trial Repo (Optional)</span>
            </span>
          </label>
          <input
            id="job-trial-repo"
            className="input-field"
            value={draft.trial_repo_url || ""}
            onChange={set("trial_repo_url")}
            placeholder="e.g. https://github.com/facebook/react or your team's open codebase"
          />
          <span style={{ fontSize: "11px", color: "var(--text-subtle)", marginTop: "4px", display: "block" }}>
            Attach a public repository. Candidates applying will be given a timed orientation test on this codebase (identifying modules, blast radius, and data flows).
          </span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="job-desc">
            What the Role Actually Is & First 90 Days <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            id="job-desc"
            className="textarea-field"
            style={{ minHeight: "130px" }}
            value={draft.description}
            onChange={set("description")}
            placeholder="Describe what systems this engineer will own, technical debt they will solve, who decides architectural tradeoffs, and what success looks like in 90 days."
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", borderTop: "1px solid var(--mist-border-light)", paddingTop: "16px" }}>
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={loading || !ready}
          >
            {loading ? (
              <span>Reading your posting & generating jury questions...</span>
            ) : (
              <>
                <span>Start Technical Verification (Audit Gate)</span>
                <CheckCircleIcon size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

