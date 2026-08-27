import React from "react";
import Avatar from "./Avatar";
import {
  BrandLogoIcon,
  QuizIcon,
  FeedIcon,
  ReputationIcon,
  JobsIcon,
  LogOutIcon,
  SparklesIcon,
} from "./Icons";

export default function Navbar({
  activeTab = "quiz",
  onSelectTab,
  userProfile,
  onLogout,
}) {
  const role = userProfile?.role || "candidate";
  const name = userProfile?.revealed ? userProfile?.name || "Candidate" : "Anonymous Candidate";
  const revealed = Boolean(userProfile?.revealed);
  const isEmployer = role === "employer";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div
          className="brand-container"
          onClick={() => onSelectTab(isEmployer ? "jobs" : "quiz")}
          style={{ cursor: "pointer" }}
        >
          <div className="brand-logo-badge">
            <BrandLogoIcon size={18} />
          </div>
          <div className="brand-info">
            <span className="brand-name">OneStop</span>
          </div>
        </div>

        {/* Center Tabs: Role-Gated */}
        <nav className="nav-tabs">
          {!isEmployer && (
            <>
              <button
                className={`nav-tab-btn ${activeTab === "quiz" ? "active" : ""}`}
                onClick={() => onSelectTab("quiz")}
              >
                <QuizIcon size={15} />
                <span>Repo Quiz</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === "bughunt" ? "active" : ""}`}
                onClick={() => onSelectTab("bughunt")}
              >
                <SparklesIcon size={15} />
                <span>Bug Hunt</span>
              </button>
            </>
          )}

          {isEmployer && (
            <button
              className={`nav-tab-btn ${activeTab === "jobs" ? "active" : ""}`}
              onClick={() => onSelectTab("jobs")}
            >
              <JobsIcon size={15} />
              <span>Post a Job</span>
            </button>
          )}

          <button
            className={`nav-tab-btn ${activeTab === "feed" ? "active" : ""}`}
            onClick={() => onSelectTab("feed")}
          >
            <FeedIcon size={15} />
            <span>Community Feed</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === "reputation" ? "active" : ""}`}
            onClick={() => onSelectTab("reputation")}
          >
            <ReputationIcon size={15} />
            <span>{isEmployer ? "Profile" : "Reputation"}</span>
          </button>

          {!isEmployer && (
            <button
              className={`nav-tab-btn ${activeTab === "jobs" ? "active" : ""}`}
              onClick={() => onSelectTab("jobs")}
            >
              <JobsIcon size={15} />
              <span>Jobs</span>
            </button>
          )}
        </nav>

        {/* Right User Bar */}
        <div className="nav-right">
          <div
            className="user-nav-chip"
            onClick={() => onSelectTab("reputation")}
            style={{ cursor: "pointer" }}
            title="View your profile & reputation"
          >
            <Avatar name={name} size="sm" revealed={revealed} role={role} showBadge />
            <div className="user-nav-meta">
              <span className="user-nav-name">{name}</span>
              <span className="user-nav-role">{role}</span>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={onLogout}
            title="Log out of OneStop"
          >
            <LogOutIcon size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
