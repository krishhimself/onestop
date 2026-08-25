/**
 * The draft posting.
 *
 * This is the last point at which the posting can be edited. Once the quiz is
 * generated the backend holds this draft and publishes that copy on a pass, so
 * the posting that goes live is the one the questions were written about.
 */
import { ShieldLockIcon } from "../../../shared/components/Icons";

export default function JobDraftForm({ draft, onChange, onSubmit, loading }) {
  const set = (field) => (e) => onChange({ ...draft, [field]: e.target.value });

  const ready =
    draft.company_name.trim() && draft.role_title.trim() && draft.description.trim();

  return (
    <div className="card" style={{ padding: "24px" }}>
      <div className="badge badge-accent" style={{ marginBottom: "10px" }}>
        <ShieldLockIcon size={12} />
        Step 1: Write the posting
      </div>

      <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "4px" }}>
        Draft the role
      </h2>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "18px", lineHeight: "1.5" }}>
        The questions are generated from what you write here, and this exact draft is
        what publishes if you defend it. There is no separate publish step to edit it
        in afterwards.
      </p>

      <div className="form-group">
        <label className="form-label" htmlFor="draft-company">
          Company
        </label>
        <input
          id="draft-company"
          className="input-field"
          value={draft.company_name}
          onChange={set("company_name")}
          placeholder="Acme"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="draft-role">
          Role
        </label>
        <input
          id="draft-role"
          className="input-field"
          value={draft.role_title}
          onChange={set("role_title")}
          placeholder="Backend Engineer"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="draft-stack">
          Tech stack
        </label>
        <input
          id="draft-stack"
          className="input-field"
          value={draft.tech_stack}
          onChange={set("tech_stack")}
          placeholder="Python, FastAPI, MongoDB"
        />
        <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
          Comma separated. You will be asked which of these the hire actually touches.
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="draft-desc">
          What the role actually is
        </label>
        <textarea
          id="draft-desc"
          className="textarea-field"
          style={{ minHeight: "110px" }}
          value={draft.description}
          onChange={set("description")}
          placeholder="What this person owns, who they work with, what the first 90 days look like."
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={loading || !ready}
        >
          {loading ? "Reading your posting..." : "Start Verification"}
        </button>
      </div>
    </div>
  );
}
