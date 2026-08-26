import { useState } from "react";
import { BrandLogoIcon, CheckCircleIcon, ShieldLockIcon } from "../../shared/components/Icons";

// [value sent as `role`, label, what picking it means]. The values must match
// schemas/auth.py's Role literal — anything else is a 422.
const ROLES = [
  ["candidate", "Candidate", "Take repo quizzes and build a profile."],
  ["employer", "Employer", "Post roles — after answering for them."],
];

export default function AuthForm({ title, submitLabel, onSubmit, signup, footer }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("candidate");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), password, role });
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  const isFormValid = email && password && (!signup || name.trim().length >= 1);

  return (
    <div className="auth-page-container">
      {/* Left Hero Banner */}
      <div className="auth-hero-banner">
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <div className="brand-logo-badge" style={{ width: "30px", height: "30px" }}>
            <BrandLogoIcon size={18} />
          </div>
          <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--navy)" }}>
            OneStop
          </span>
        </div>

        <h1 className="auth-hero-title">
          Verify comprehension, <br />
          <span style={{ color: "var(--accent)" }}>not credentials.</span>
        </h1>

        <p className="auth-hero-desc">
          Claims are cheap in the AI era. OneStop evaluates real engineering understanding through live repo quizzes, anti-gaming clocks, and adaptive defences.
        </p>

        <div className="auth-hero-features">
          <div className="auth-feature-row">
            <CheckCircleIcon size={16} style={{ color: "var(--success)", flexShrink: 0, marginTop: "2px" }} />
            <span><strong>Anonymous-first profiles:</strong> Your code earns your introduction before your identity is revealed.</span>
          </div>

          <div className="auth-feature-row">
            <ShieldLockIcon size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
            <span><strong>Adaptive defense rounds:</strong> An AI jury questions your exact reasoning under live clocks.</span>
          </div>

          <div className="auth-feature-row">
            <CheckCircleIcon size={16} style={{ color: "var(--navy)", flexShrink: 0, marginTop: "2px" }} />
            <span><strong>Gated job postings:</strong> Companies prove role realities before hiring candidates.</span>
          </div>
        </div>
      </div>

      {/* Right Auth Card */}
      <div className="auth-card-wrap">
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}>{title}</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {signup ? "Create your candidate or employer account." : "Sign in to access your dashboard."}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {signup && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="auth-name">
                Full Name
              </label>
              <input
                id="auth-name"
                type="text"
                className="input-field"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
              <span className="form-hint">
                Kept anonymous until a defended quiz score clears the 70+ reveal bar.
              </span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="auth-email">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              className="input-field"
              placeholder="developer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className="input-field"
              placeholder={signup ? "Minimum 8 characters" : "Enter password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 8 : undefined}
              required
            />
          </div>

          {signup && (
            <fieldset className="role-choice">
              <legend>I am a</legend>
              {ROLES.map(([value, label, hint]) => (
                <label key={value} className={role === value ? "chosen" : ""}>
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                  />
                  <span>
                    {label}
                    <span className="hint">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={busy || !isFormValid}
            style={{ width: "100%", marginTop: "6px" }}
          >
            {busy ? "Authenticating..." : submitLabel}
          </button>

          {footer}
        </form>
      </div>
    </div>
  );
}
