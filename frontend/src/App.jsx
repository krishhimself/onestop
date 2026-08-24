import { useState } from "react";
import QuizPage from "./features/quiz/QuizPage";
import ProfilePage from "./features/profile/ProfilePage";
import ReputationPage from "./features/reputation/ReputationPage";
import PostJobPage from "./features/jobs/PostJobPage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import { isLoggedIn, logout } from "./features/auth/api";
import { getRole } from "./shared/api/token";

// Swap for a router (react-router) once the community pages exist.
export default function App() {
  // Seeded from storage so a reload does not log you out.
  const [authed, setAuthed] = useState(isLoggedIn);
  const [showRegister, setShowRegister] = useState(false);
  // Employers land on the posting flow; candidates on the repo quiz. Both are the
  // thing that account type came here to do.
  const [tab, setTab] = useState(() => (getRole() === "employer" ? "post" : "quiz"));

  if (!authed) {
    const Page = showRegister ? RegisterPage : LoginPage;
    return (
      <div className="container">
        <h1>OneStop</h1>
        <p className="tagline">Log in to take a repo quiz.</p>
        <Page
          onAuthed={() => {
            setTab(getRole() === "employer" ? "post" : "quiz");
            setAuthed(true);
          }}
          onSwitch={() => setShowRegister((v) => !v)}
        />
      </div>
    );
  }

  const onUnauthorized = () => setAuthed(false);

  // One flow per account type: an employer answers for postings, a candidate
  // answers for repos. Neither is offered the other's, because neither number
  // means anything on the wrong side of the market.
  //
  // Hiding a tab is a convenience, not the gate: every company-quiz route is
  // employer-only on the backend, checked against the signed token.
  const employer = getRole() === "employer";
  const tabs = [
    employer ? ["post", "Post a Job"] : ["quiz", "Quiz"],
    ["profile", "Profile"],
    // Reputation is quiz depth plus what happened when you applied, so it is a
    // candidate instrument; an employer looking at their own would read zeros.
    ...(employer ? [] : [["reputation", "Reputation"]]),
  ];

  return (
    <>
      <div className="topbar">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={`linkish${tab === id ? " current" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
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

      {tab === "post" && <PostJobPage onUnauthorized={onUnauthorized} />}
      {tab === "quiz" && <QuizPage onUnauthorized={onUnauthorized} />}
      {/* Re-fetched on every visit, so a reveal earned in the quiz tab shows up as
          soon as the candidate looks. */}
      {tab === "profile" && (
        <ProfilePage
          onUnauthorized={onUnauthorized}
          onViewReputation={employer ? undefined : () => setTab("reputation")}
        />
      )}
      {tab === "reputation" && <ReputationPage onUnauthorized={onUnauthorized} />}
    </>
  );
}
