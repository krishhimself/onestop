import { useState } from "react";

/**
 * Shared form body for login and register.
 *
 * Deliberately plain — this gates the quiz flow, it is not a UI milestone.
 */
export default function AuthForm({ title, submitLabel, onSubmit, showRole, footer }) {
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
      await onSubmit({ email, password, role });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth" onSubmit={handleSubmit}>
      <h2>{title}</h2>

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
          autoComplete={showRole ? "new-password" : "current-password"}
          minLength={showRole ? 8 : undefined}
          required
        />
      </label>

      {showRole && (
        <label>
          I am a
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="candidate">Candidate</option>
            <option value="employer">Employer</option>
          </select>
        </label>
      )}

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy || !email || !password}>
        {busy ? "Working..." : submitLabel}
      </button>

      {footer}
    </form>
  );
}
