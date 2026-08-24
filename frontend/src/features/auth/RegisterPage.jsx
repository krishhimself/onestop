import AuthForm from "./AuthForm";
import { register } from "./api";

export default function RegisterPage({ onAuthed, onSwitch }) {
  return (
    <AuthForm
      title="Create Account"
      submitLabel="Complete Registration"
      signup
      onSubmit={async ({ name, email, password, role }) => {
        await register(name, email, password, role);
        onAuthed();
      }}
      footer={
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--accent-text)", fontWeight: "700", textDecoration: "underline", display: "inline" }}
              onClick={onSwitch}
            >
              Sign in instead
            </button>
          </p>
        </div>
      }
    />
  );
}
