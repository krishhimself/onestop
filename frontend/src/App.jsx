import { useState } from "react";
import QuizPage from "./features/quiz/QuizPage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import { isLoggedIn, logout } from "./features/auth/api";

// Swap for a router (react-router) once the jobs/community pages exist.
export default function App() {
  // Seeded from storage so a reload does not log you out.
  const [authed, setAuthed] = useState(isLoggedIn);
  const [showRegister, setShowRegister] = useState(false);

  if (!authed) {
    const Page = showRegister ? RegisterPage : LoginPage;
    return (
      <div className="container">
        <h1>OneStop</h1>
        <p className="tagline">Log in to take a repo quiz.</p>
        <Page onAuthed={() => setAuthed(true)} onSwitch={() => setShowRegister((v) => !v)} />
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <button
          className="linkish"
          onClick={() => {
            logout();
            setAuthed(false);
          }}
        >
          Log out
        </button>
      </div>
      <QuizPage onUnauthorized={() => setAuthed(false)} />
    </>
  );
}
