import { useEffect, useState } from "react";
import { getProfile } from "./api";
import { getReputation } from "../reputation/api";
import { displayName, ANONYMOUS_NAME } from "./display";
import { getUserId } from "../../shared/api/token";
import { connectTo } from "../community/api";
import Avatar from "../../shared/components/Avatar";
import {
  ShieldLockIcon,
  CheckCircleIcon,
  FileCodeIcon,
  JobsIcon,
  QuizIcon,
  ReputationIcon,
  UserIcon,
  ClockIcon,
} from "../../shared/components/Icons";

export default function ProfilePage({ userId, onUnauthorized, onNavigateQuiz, onViewReputation }) {
  const subject = userId ?? getUserId();
  const [profile, setProfile] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);

  const viewingSomeoneElse = Boolean(subject) && subject !== getUserId();

  async function handleConnect() {
    setConnection({ busy: true });
    try {
      const result = await connectTo(subject);
      setConnection({ done: true, created: result.created });
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
    Promise.all([
      getProfile(subject).catch(() => null),
      getReputation(subject).catch(() => null),
    ])
      .then(([profData, repData]) => {
        if (!live) return;
        if (profData) setProfile(profData);
        if (repData) setReputation(repData);
      })
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
              {profile?.role === "employer" ? "Employer / Hiring Manager" : "Software Engineer"}
            </span>

            {revealed && profile?.email && (
              <span style={{ fontSize: "12px", color: "var(--accent)", fontFamily: "monospace" }}>
                {profile.email}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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

          {onViewReputation && (
            <button className="btn btn-secondary" onClick={onViewReputation}>
              <ReputationIcon size={14} />
              <span>Reputation Score</span>
            </button>
          )}

          {profile?.role === "employer" ? (
            onNavigateQuiz && (
              <button className="btn btn-primary" onClick={onNavigateQuiz}>
                <JobsIcon size={14} />
                <span>Post a Job (Quiz Gated)</span>
              </button>
            )
          ) : (
            !revealed && onNavigateQuiz && (
              <button className="btn btn-primary" onClick={onNavigateQuiz}>
                <QuizIcon size={14} />
                <span>Take Repo Quiz to Unlock</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Reveal / Account Status Notice */}
      <div className={`card ${revealed ? "alert-success" : profile?.role === "employer" ? "alert-info" : "alert-info"}`} style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          {revealed ? (
            <CheckCircleIcon size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: "2px" }} />
          ) : profile?.role === "employer" ? (
            <JobsIcon size={18} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
          ) : (
            <ShieldLockIcon size={18} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
          )}

          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "2px", color: "var(--text-main)" }}>
              {profile?.role === "employer"
                ? "Employer Account — Posting Quiz Gate Active"
                : revealed
                ? "Identity Verification: Unlocked"
                : "Anonymous-First Profile Active"}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              {profile?.role === "employer"
                ? "All job postings you create are gated behind a live company-side technical quiz (score 70+ required) to guarantee that every posting reflects genuine engineering understanding."
                : revealed
                ? "You passed a defended repository quiz with a score of 70/100 or higher. Employers viewing your applications or candidate profile now see your real name and verified contact details."
                : "Your name and email remain hidden until you score 70+ on a defended repo quiz. Code earns the introduction before credentials matter."}
            </p>
          </div>
        </div>
      </div>

      {/* Comprehension & Reputation Breakdown */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)" }}>
              Comprehension Breakdown
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Independent architectural pillars — never flattened into one opaque blended number.
            </p>
          </div>
          <span className="badge badge-accent">Multi-Signal Audit</span>
        </div>

        <div className="reputation-grid">
          {/* Pillar 1: Problem Understanding */}
          <div className="rep-stat-card">
            <span className="rep-stat-label">Pillar I</span>
            <h4 style={{ fontSize: "14px", fontWeight: "600" }}>Problem Understanding</h4>
            <span className="rep-stat-value" style={{ color: "var(--text-main)" }}>
              {revealed ? "Verified" : "Evaluating"}
            </span>
            <p className="rep-stat-desc">
              Domain context, user requirements, and core problems solved.
            </p>
          </div>

          {/* Pillar 2: Logic & Reasoning */}
          <div className="rep-stat-card">
            <span className="rep-stat-label">Pillar II</span>
            <h4 style={{ fontSize: "14px", fontWeight: "600" }}>Logic & Reasoning</h4>
            <span className="rep-stat-value" style={{ color: "var(--accent)" }}>
              {revealed ? "High Defense" : "Pending"}
            </span>
            <p className="rep-stat-desc">
              End-to-end execution paths, internal invariants, and state manipulation.
            </p>
          </div>

          {/* Pillar 3: Tech Stack Awareness */}
          <div className="rep-stat-card">
            <span className="rep-stat-label">Pillar III</span>
            <h4 style={{ fontSize: "14px", fontWeight: "600" }}>Tech Stack Awareness</h4>
            <span className="rep-stat-value" style={{ color: "var(--navy)" }}>
              {revealed ? "Architect" : "Pending"}
            </span>
            <p className="rep-stat-desc">
              Library choices, framework trade-offs, and design patterns.
            </p>
          </div>

          {/* Pillar 4: Usage & Edge Cases */}
          <div className="rep-stat-card">
            <span className="rep-stat-label">Pillar IV</span>
            <h4 style={{ fontSize: "14px", fontWeight: "600" }}>Usage & Edge Cases</h4>
            <span className="rep-stat-value" style={{ color: "var(--success)" }}>
              {revealed ? "Verified" : "Pending"}
            </span>
            <p className="rep-stat-desc">
              Failure boundaries, error propagation, and concurrency handling.
            </p>
          </div>
        </div>
      </div>

      {/* Rounds Reached & Complexity Records */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "12px" }}>
          Rounds Reached & Complexity Records
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
          {/* Card 1: Project Complexity Tier Distribution */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <FileCodeIcon size={14} style={{ color: "var(--text-subtle)" }} />
                <span>Project Complexity Tiers</span>
              </span>
              <span className="badge badge-cream">Calibrated</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
              Independent repo complexity rating (file count, async patterns, state management, tests).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Complex Systems</span>
                <span className="badge badge-accent">Tier 3</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Moderate Fullstack / APIs</span>
                <span className="badge badge-mist">Tier 2</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Trivial Repositories</span>
                <span className="badge badge-cream">Tier 1</span>
              </div>
            </div>
          </div>

          {/* Card 2: Interview & Defense Funnel */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <JobsIcon size={14} style={{ color: "var(--accent)" }} />
                <span>Rounds Reached History</span>
              </span>
              <span className="badge badge-accent">Live Funnel</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
              Progression through adaptive defenses and employer interview loops.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Adaptive Follow-Up Defenses</span>
                <span style={{ fontWeight: "600", color: "var(--text-main)" }}>{revealed ? "Passed" : "0"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Employer Direct Intros</span>
                <span style={{ fontWeight: "600", color: "var(--text-main)" }}>{revealed ? "Active" : "Locked"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Identity Latch Status</span>
                <span style={{ fontWeight: "600", color: revealed ? "var(--success)" : "var(--cream-text)" }}>
                  {revealed ? "Revealed" : "Anonymous"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Day-1 Readiness Breakdown */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <ClockIcon size={14} style={{ color: "var(--accent)" }} />
                <span>Day-1 Readiness Record</span>
              </span>
              <span className="badge badge-accent">Unfamiliar Code</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
              Comprehension and orientation speed on unfamiliar codebases from job applications.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Day-1 Readiness Score</span>
                <span style={{ fontWeight: "700", color: reputation?.day1_readiness ? "var(--accent)" : "var(--text-subtle)", fontSize: "14px" }}>
                  {reputation?.day1_readiness ? `${reputation.day1_readiness} / 100` : "0 / 100"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Candidate Repo Comprehension</span>
                <span style={{ fontWeight: "600", color: "var(--text-main)" }}>
                  {reputation?.comprehension ? `${reputation.comprehension} / 100` : "0 / 100"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Component Blending</span>
                <span className="badge badge-mist">Independent (Unblended)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
