import AuthForm from "./AuthForm";
import { login } from "./api";

export default function LoginPage({ onAuthed, onSwitch }) {
  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      onSubmit={async ({ email, password }) => {
        await login(email, password);
        onAuthed();
      }}
      footer={
        <p className="switch">
          No account?{" "}
          <button type="button" className="linkish" onClick={onSwitch}>
            Register
          </button>
        </p>
      }
    />
  );
}
