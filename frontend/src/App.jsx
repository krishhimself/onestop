import { useEffect, useState } from "react";
import Navbar from "./shared/components/Navbar";
import Avatar from "./shared/components/Avatar";
import QuizPage from "./features/quiz/QuizPage";
import ProfilePage from "./features/profile/ProfilePage";
import ReputationPage from "./features/reputation/ReputationPage";
import JobsPage from "./features/jobs/JobsPage";
import FeedPage from "./features/feed/FeedPage";
import SuggestedPeers from "./features/feed/components/SuggestedPeers";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import { isLoggedIn, logout } from "./features/auth/api";
import { getProfile } from "./features/profile/api";
import { displayName } from "./features/profile/display";
import { getUserId, getRole } from "./shared/api/token";
import {
  ShieldLockIcon,
  CheckCircleIcon,
  ReputationIcon,
  PlusIcon,
} from "./shared/components/Icons";

export default function App() {
  // Seeded from storage so a reload does not log you out.
  const [authed, setAuthed] = useState(isLoggedIn);
  const [showRegister, setShowRegister] = useState(false);
  const [tab, setTab] = useState(() => (getRole() === "employer" ? "jobs" : "quiz"));
  const [userProfile, setUserProfile] = useState(null);

  const userId = getUserId();

  function loadUserProfile() {
    if (!userId) return;
    getProfile(userId)
      .then((data) => setUserProfile(data))
      .catch(() => {
        setUserProfile({
          user_id: userId,
          name: "Anonymous Candidate",
          email: null,
          role: getRole() || "candidate",
          revealed: false,
        });
      });
  }

  useEffect(() => {
    if (authed) {
      loadUserProfile();
    } else {
      setUserProfile(null);
    }
  }, [authed, tab]);

  if (!authed) {
    const AuthView = showRegister ? RegisterPage : LoginPage;
    return (
      <div className="app-shell" style={{ justifyContent: "center" }}>
        <AuthView
          onAuthed={() => {
            setTab(getRole() === "employer" ? "jobs" : "quiz");
            setAuthed(true);
            loadUserProfile();
          }}
          onSwitch={() => setShowRegister((v) => !v)}
        />
      </div>
    );
  }

  const onUnauthorized = () => {
    logout();
    setAuthed(false);
  };

  const name = displayName(userProfile);
  const revealed = Boolean(userProfile?.revealed);
  const role = userProfile?.role || getRole() || "candidate";
  const isEmployer = role === "employer";

  // Prevent role mismatch on tab (e.g. employer on repo quiz or candidate on employer post flow)
  const currentTab = isEmployer && tab === "quiz" ? "jobs" : tab;

  return (
    <div className="app-shell">
      {/* Top Navbar */}
      <Navbar
        activeTab={currentTab}
        onSelectTab={setTab}
        userProfile={userProfile}
        onLogout={() => {
          logout();
          setAuthed(false);
        }}
      />

      {/* Main 3-Column Layout */}
      <main className={`main-layout ${currentTab === "quiz" ? "no-right-col" : ""}`}>
        {/* LEFT COLUMN: Profile & Verification Mini-Card */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="card" style={{ padding: "18px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
              <Avatar
                name={name}
                size="lg"
                revealed={revealed}
                role={role}
                showBadge
              />
            </div>

            <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "2px" }}>
              {name}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-subtle)", marginBottom: "10px" }}>
              {isEmployer ? "Verified Employer" : "Software Engineer"}
            </p>

            <div style={{ display: "inline-flex", marginBottom: "14px" }}>
              {isEmployer ? (
                <span className="badge badge-accent">
                  <CheckCircleIcon size={11} />
                  Verified Employer
                </span>
              ) : revealed ? (
                <span className="badge badge-success">
                  <CheckCircleIcon size={11} />
                  Identity Revealed
                </span>
              ) : (
                <span className="badge badge-cream">
                  <ShieldLockIcon size={11} />
                  Anonymous Pseudonym
                </span>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--mist-border-light)", paddingTop: "10px", textAlign: "left", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", color: "var(--text-muted)" }}>
                <span>Account Status:</span>
                <strong style={{ color: isEmployer || revealed ? "var(--success)" : "var(--cream-text)" }}>
                  {isEmployer ? "Employer Gate Active" : revealed ? "Unlocked" : "Locked (<70)"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span>Active Role:</span>
                <span style={{ textTransform: "capitalize", fontWeight: "600", color: "var(--text-main)" }}>
                  {role}
                </span>
              </div>
            </div>

            {isEmployer ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setTab("jobs")}
                style={{ width: "100%", marginTop: "12px" }}
              >
                <PlusIcon size={13} />
                <span>Post a Job</span>
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setTab("reputation")}
                style={{ width: "100%", marginTop: "12px" }}
              >
                <ReputationIcon size={13} />
                <span>View Full Reputation</span>
              </button>
            )}
          </div>

          {/* Quick Platform Values Widget */}
          <div className="sidebar-widget">
            <div className="sidebar-widget-title">
              <span>Platform Verification</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              • Comprehension over credentials<br />
              • Wall-clock timer countdown<br />
              • Silent typing delta analysis<br />
              • Adaptive jury defense round
            </p>
          </div>
        </aside>

        {/* CENTER COLUMN: Interactive Workspace */}
        <section style={{ minWidth: 0 }}>
          {!isEmployer && currentTab === "quiz" && (
            <QuizPage
              onUnauthorized={onUnauthorized}
              onNavigateReputation={() => setTab("reputation")}
            />
          )}

          {currentTab === "feed" && (
            <FeedPage
              userProfile={userProfile}
              onNavigateQuiz={() => setTab(isEmployer ? "jobs" : "quiz")}
              onNavigateReputation={() => setTab("reputation")}
            />
          )}

          {currentTab === "reputation" && (
            <ProfilePage
              onUnauthorized={onUnauthorized}
              onNavigateQuiz={() => setTab(isEmployer ? "jobs" : "quiz")}
            />
          )}

          {currentTab === "jobs" && (
            <JobsPage
              onUnauthorized={onUnauthorized}
              userProfile={userProfile}
            />
          )}
        </section>

        {/* RIGHT COLUMN: Verified Engineers / Connections */}
        {tab !== "quiz" && <SuggestedPeers />}
      </main>
    </div>
  );
}
