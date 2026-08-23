import { useState } from "react";
import QuizPage from "./features/quiz/QuizPage";
import ProfilePage from "./features/profile/ProfilePage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import { isLoggedIn, logout } from "./features/auth/api";

// Swap for a router (react-router) once the jobs/community pages exist.
export default function App() {
  // Seeded from storage so a reload does not log you out.
  const [authed, setAuthed] = useState(isLoggedIn);
  const [showRegister, setShowRegister] = useState(false);
  const [tab, setTab] = useState("quiz");

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

  const onUnauthorized = () => setAuthed(false);

  return (
    <>
      <div className="topbar">
        <button
          className={`linkish${tab === "quiz" ? " current" : ""}`}
          onClick={() => setTab("quiz")}
        >
          Quiz
        </button>
        <button
          className={`linkish${tab === "profile" ? " current" : ""}`}
          onClick={() => setTab("profile")}
        >
          Profile
        </button>
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
      {tab === "quiz" ? (
        <QuizPage onUnauthorized={onUnauthorized} />
      ) : (
        // Re-fetched on every visit, so a reveal earned in the quiz tab shows up
        // as soon as the candidate looks.
        <ProfilePage onUnauthorized={onUnauthorized} />
      )}
    </>
  );
}
