import AuthForm from "./AuthForm";
import { register } from "./api";

export default function RegisterPage({ onAuthed, onSwitch }) {
  return (
    <AuthForm
      title="Create an account"
      submitLabel="Register"
      showRole
      onSubmit={async ({ email, password, role }) => {
        await register(email, password, role);
        onAuthed();
      }}
      footer={
        <p className="switch">
          Already registered?{" "}
          <button type="button" className="linkish" onClick={onSwitch}>
            Log in
          </button>
        </p>
      }
    />
  );
}
