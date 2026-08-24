import AuthForm from "./AuthForm";
import { login } from "./api";

export default function LoginPage({ onAuthed, onSwitch }) {
  return (
    <AuthForm
      title="Sign In"
      submitLabel="Sign In to OneStop"
      onSubmit={async ({ email, password }) => {
        await login(email, password);
        onAuthed();
      }}
      footer={
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Don't have an account?{" "}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--accent-text)", fontWeight: "700", textDecoration: "underline", display: "inline" }}
              onClick={onSwitch}
            >
              Create an account
            </button>
          </p>
        </div>
      }
    />
  );
}
