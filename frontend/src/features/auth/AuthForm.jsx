import { useState } from "react";

/**
 * Shared form body for login and register.
 *
 * Deliberately plain — this gates the quiz flow, it is not a UI milestone.
 *
 * `signup` is the one switch between the two modes. It was `showRole` until the
 * name field arrived and made it three things at once; naming it for the mode
 * rather than for one of the fields keeps the next addition from repeating that.
 */
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
      await onSubmit({ name: name.trim(), email, password, role });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth" onSubmit={handleSubmit}>
      <h2>{title}</h2>

      {signup && (
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={80}
            required
          />
          <span className="hint">
            Nobody sees this until a quiz score reveals your profile.
          </span>
        </label>
      )}

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={signup ? 8 : undefined}
          required
        />
      </label>

      {/* Radios rather than a dropdown: this choice decides which half of the
          product you land in, so both options should be visible without opening
          anything. The value is still only a hint — every employer-only route
          re-checks the role against the signed token. */}
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

      {error && <p className="error">{error}</p>}

      {/* A name of spaces would pass `required`, so the trimmed value is what gates
          the button — same rule the backend enforces. */}
      <button type="submit" disabled={busy || !email || !password || (signup && !name.trim())}>
        {busy ? "Working..." : submitLabel}
      </button>

      {footer}
    </form>
  );
}
