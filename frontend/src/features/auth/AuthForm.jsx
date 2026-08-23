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

      {signup && (
        <label>
          I am a
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="candidate">Candidate</option>
            <option value="employer">Employer</option>
          </select>
        </label>
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
