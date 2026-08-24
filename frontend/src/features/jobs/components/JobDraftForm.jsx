/**
 * The draft posting.
 *
 * This is the last point at which the posting can be edited. Once the quiz is
 * generated the backend holds this draft and publishes that copy on a pass, so
 * the posting that goes live is the one the questions were written about.
 */
export default function JobDraftForm({ draft, onChange, onSubmit, loading }) {
  const set = (field) => (e) => onChange({ ...draft, [field]: e.target.value });

  const ready =
    draft.company_name.trim() && draft.role_title.trim() && draft.description.trim();

  return (
    <div className="draft">
      <label>
        Company
        <input value={draft.company_name} onChange={set("company_name")} placeholder="Acme" />
      </label>

      <label>
        Role
        <input value={draft.role_title} onChange={set("role_title")} placeholder="Backend Engineer" />
      </label>

      <label>
        Tech stack
        <input
          value={draft.tech_stack}
          onChange={set("tech_stack")}
          placeholder="Python, FastAPI, MongoDB"
        />
        <span className="hint">Comma separated. You will be asked which of these the hire actually touches.</span>
      </label>

      <label>
        What the role actually is
        <textarea
          value={draft.description}
          onChange={set("description")}
          placeholder="What this person owns, who they work with, what the first 90 days look like."
        />
      </label>

      <button onClick={onSubmit} disabled={loading || !ready}>
        {loading ? "Reading your posting..." : "Start Verification"}
      </button>
    </div>
  );
}
