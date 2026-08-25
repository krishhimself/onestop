import { useEffect, useState } from "react";
import { getProfile } from "./api";
import { displayName, ANONYMOUS_NAME } from "./display";
import { getUserId } from "../../shared/api/token";
import { connectTo } from "../community/api";
import ReputationPage from "../reputation/ReputationPage";
import Avatar from "../../shared/components/Avatar";
import {
  ShieldLockIcon,
  CheckCircleIcon,
  QuizIcon,
  UserIcon,
} from "../../shared/components/Icons";

export default function ProfilePage({ userId, onUnauthorized, onNavigateQuiz, onBack, onConnected }) {
  const subject = userId ?? getUserId();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);

  const viewingSomeoneElse = Boolean(subject) && subject !== getUserId();

  async function handleConnect() {
    setConnection({ busy: true });
    try {
      const result = await connectTo(subject);
      setConnection({ done: true, created: result.created });
      // Only a new pair changes the sidebar; a repeat returns created: false.
      if (result.created) onConnected?.();
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setConnection(null);
      setError(e.message);
    }
  }

  useEffect(() => {
    let live = true;
    if (!subject) {
      setError("No profile found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getProfile(subject)
      .then((data) => live && setProfile(data))
      .catch((e) => {
        if (!live) return;
        if (e.status === 401) return onUnauthorized?.();
        setError(e.message || "Failed to load candidate profile.");
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [subject]);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          Loading verified candidate reputation...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  const revealed = Boolean(profile?.revealed);
  const name = displayName(profile);

  return (
    <div className="reputation-container">
      {/* Profile Header Hero */}
      <div className="profile-hero-card">
        <div className="profile-identity-group">
          <Avatar
            name={name}
            size="lg"
            revealed={revealed}
            role={profile?.role || "candidate"}
            showBadge
          />

          <div className="profile-names-wrap">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h1 className="profile-main-name">{name}</h1>
              {revealed ? (
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

            <span className="profile-role-sub">
              {profile?.role === "employer" ? "Verified Employer / Recruiter" : "Software Engineer"}
            </span>

            {revealed && profile?.email && (
              <span style={{ fontSize: "12px", color: "var(--accent)", fontFamily: "monospace" }}>
                {profile.email}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {viewingSomeoneElse && onBack && (
            <button className="btn btn-ghost" onClick={onBack}>
              <span>Back to your profile</span>
            </button>
          )}

          {viewingSomeoneElse && (
            <button
              className={`btn ${connection?.done ? "btn-secondary" : "btn-primary"}`}
              onClick={handleConnect}
              disabled={connection?.busy || connection?.done}
            >
              <UserIcon size={14} />
              <span>
                {connection?.done
                  ? connection.created
                    ? "Connected"
                    : "Already Connected"
                  : connection?.busy
                  ? "Connecting..."
                  : "Connect"}
              </span>
            </button>
          )}

          {!revealed && !viewingSomeoneElse && onNavigateQuiz && (
            <button className="btn btn-primary" onClick={onNavigateQuiz}>
              <QuizIcon size={14} />
              <span>Take Repo Quiz to Unlock</span>
            </button>
          )}
        </div>
      </div>

      {/* Reveal Status Notice */}
      <div className={`card ${revealed ? "alert-success" : "alert-info"}`} style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          {revealed ? (
            <CheckCircleIcon size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: "2px" }} />
          ) : (
            <ShieldLockIcon size={18} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
          )}

          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "2px", color: "var(--text-main)" }}>
              {revealed
                ? "Identity Verification: Unlocked"
                : "Anonymous-First Profile Active"}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              {viewingSomeoneElse
                ? revealed
                  ? "This candidate cleared a defended repo quiz at 70/100 or better, which is what released their name and contact details."
                  : "This candidate is a pseudonym until they clear a defended repo quiz at 70+. Their name is not withheld by this page — it is not in the response at all."
                : revealed
                ? "You passed a defended repository quiz with a score of 70/100 or higher. Employers viewing your applications or candidate profile now see your real name and verified contact details."
                : "Your name and email remain hidden until you score 70+ on a defended repo quiz. Code earns the introduction before credentials matter."}
            </p>
          </div>
        </div>
      </div>

      {/* The reputation breakdown, from GET /users/{id}/reputation.
          Rendered by the component that owns the invariant rather than restated
          here: the overall figure must never appear without quiz_count next to
          it, and one copy of that rule is the only way it stays true. */}
      <ReputationPage userId={subject} onUnauthorized={onUnauthorized} />

    </div>
  );
}
