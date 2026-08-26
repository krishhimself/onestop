import { useEffect, useState } from "react";
import {
  fetchJobs,
  applyToJob,
  fetchEmployerApplications,
  fetchCandidateApplications,
  updateApplicationStatus,
} from "./api";
import { getUserId, getRole } from "../../shared/api/token";
import QuizPage from "../quiz/QuizPage";
import PostJobPage from "./PostJobPage";
import Avatar from "../../shared/components/Avatar";
import {
  JobsIcon,
  CheckCircleIcon,
  ShieldLockIcon,
  PlusIcon,
  FileCodeIcon,
  ClockIcon,
  ReputationIcon,
  UserIcon,
} from "../../shared/components/Icons";

export default function JobsPage({ onUnauthorized, userProfile }) {
  const userId = getUserId();
  const role = userProfile?.role || getRole() || "candidate";
  const isEmployer = role === "employer";

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState(() => (isEmployer ? "post" : "browse"));

  // Employer Applications Review State
  const [employerApps, setEmployerApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [updatingAppId, setUpdatingAppId] = useState(null);

  // Candidate My Applications State
  const [candidateApps, setCandidateApps] = useState([]);
  const [candAppsLoading, setCandAppsLoading] = useState(false);

  // Application State
  const [appliedJobs, setAppliedJobs] = useState(() => new Set());
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [applySuccessId, setApplySuccessId] = useState(null);

  // Day-1 Readiness Test Application State
  const [activeDay1Job, setActiveDay1Job] = useState(null);
  const [day1ApplicationResult, setDay1ApplicationResult] = useState(null);

  async function loadJobs() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      setError(err.message || "Failed to load active job postings.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployerApplications() {
    setAppsLoading(true);
    setError("");
    try {
      const data = await fetchEmployerApplications();
      setEmployerApps(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      setError(err.message || "Failed to load candidate applications.");
    } finally {
      setAppsLoading(false);
    }
  }

  async function loadCandidateApplications() {
    setCandAppsLoading(true);
    setError("");
    try {
      const data = await fetchCandidateApplications();
      setCandidateApps(Array.isArray(data) ? data : []);
      const ids = new Set((data || []).map((a) => a.job_id));
      setAppliedJobs(ids);
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      setError(err.message || "Failed to load your applications.");
    } finally {
      setCandAppsLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
    if (isEmployer) {
      loadEmployerApplications();
    } else {
      loadCandidateApplications();
    }
  }, [isEmployer]);

  async function handleApply(job) {
    if (!userId) return onUnauthorized?.();

    // If the job has a trial_repo_url attached, route candidate through Day-1 quiz first!
    if (job.trial_repo_url?.trim()) {
      setActiveDay1Job(job);
      return;
    }

    setApplyingJobId(job.id);
    try {
      await applyToJob(job.id, userId);
      setAppliedJobs((prev) => new Set(prev).add(job.id));
      setApplySuccessId(job.id);
      setTimeout(() => setApplySuccessId(null), 4000);
      loadCandidateApplications();
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      alert("Application failed: " + err.message);
    } finally {
      setApplyingJobId(null);
    }
  }

  async function handleDay1Complete(result, quizId) {
    if (!activeDay1Job || !userId) return;
    const finalScore = Math.round(result?.score ?? result?.overall_score ?? 0);
    setApplyingJobId(activeDay1Job.id);
    try {
      await applyToJob(activeDay1Job.id, userId, null, quizId, finalScore);
      setAppliedJobs((prev) => new Set(prev).add(activeDay1Job.id));
      setDay1ApplicationResult({
        job: activeDay1Job,
        score: finalScore,
        feedback: result?.feedback || [],
      });
      setActiveDay1Job(null);
      loadCandidateApplications();
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      alert("Day-1 Application submission failed: " + err.message);
    } finally {
      setApplyingJobId(null);
    }
  }

  async function handleUpdateStatus(appId, newStatus) {
    setUpdatingAppId(appId);
    try {
      await updateApplicationStatus(appId, newStatus);
      setEmployerApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingAppId(null);
    }
  }

  return (
    <div className="jobs-container">
      {/* Top Header */}
      <div className="page-hero">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <h1 className="page-hero-title">
                Verified Engineering Roles
              </h1>
              <span className="badge badge-accent">Proof-Gated</span>
            </div>
            <p className="page-hero-desc">
              Every role is posted with verified technical expectations. Candidates apply with defended comprehension profiles.
            </p>
          </div>

          {/* Navigation Tab Pills */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {isEmployer ? (
              <>
                <button
                  className={`btn ${activeView === "post" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveView("post")}
                >
                  <PlusIcon size={14} />
                  <span>Post Verified Role</span>
                </button>

                <button
                  className={`btn ${activeView === "applicants" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setActiveView("applicants");
                    loadEmployerApplications();
                  }}
                >
                  <UserIcon size={14} />
                  <span>Applicant Review ({employerApps.length})</span>
                </button>

                <button
                  className={`btn ${activeView === "browse" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveView("browse")}
                >
                  <JobsIcon size={14} />
                  <span>Active Roles ({jobs.length})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className={`btn ${activeView === "browse" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveView("browse")}
                >
                  <JobsIcon size={14} />
                  <span>Browse Roles ({jobs.length})</span>
                </button>

                <button
                  className={`btn ${activeView === "my-applications" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setActiveView("my-applications");
                    loadCandidateApplications();
                  }}
                >
                  <FileCodeIcon size={14} />
                  <span>My Applications ({candidateApps.length})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* VIEW 0: Active Day-1 Readiness Quiz Flow */}
      {activeDay1Job && (
        <div style={{ marginBottom: "24px" }}>
          <QuizPage
            isDay1={true}
            day1Job={activeDay1Job}
            onUnauthorized={onUnauthorized}
            onCancel={() => setActiveDay1Job(null)}
            onDay1Complete={handleDay1Complete}
          />
        </div>
      )}

      {/* VIEW 0.5: Day-1 Application Submission Confirmation */}
      {day1ApplicationResult && !activeDay1Job && (
        <div className="card" style={{ padding: "36px 20px", textAlign: "center", marginBottom: "20px" }}>
          <CheckCircleIcon size={44} style={{ color: "var(--success)", marginBottom: "12px" }} />
          <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}>
            Application Submitted with Day-1 Score
          </h2>
          <p style={{ color: "var(--text-muted)", maxWidth: "520px", margin: "0 auto 16px", fontSize: "13px", lineHeight: "1.5" }}>
            Your orientation and comprehension on <strong>{day1ApplicationResult.job.role_title}</strong>'s trial repository has been evaluated and recorded.
          </p>

          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              background: "var(--card-bg-subtle)",
              border: "1px solid var(--mist-border-light)",
              borderRadius: "12px",
              padding: "16px 28px",
              marginBottom: "20px",
            }}
          >
            <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-subtle)", fontWeight: "600" }}>
              Day-1 Readiness Score
            </span>
            <span style={{ fontSize: "36px", fontWeight: "800", color: "var(--accent)", margin: "4px 0" }}>
              {day1ApplicationResult.score}
              <span style={{ fontSize: "16px", fontWeight: "500", color: "var(--text-subtle)" }}> / 100</span>
            </span>
            <span className="badge badge-accent">
              Recorded on Application & Reputation Breakdown
            </span>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => setDay1ApplicationResult(null)}
            >
              Continue Browsing Roles
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: Browse Jobs */}
      {!activeDay1Job && !day1ApplicationResult && activeView === "browse" && (
        <div>
          {loading ? (
            <div className="card" style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading verified job listings...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <JobsIcon size={32} style={{ color: "var(--text-subtle)", marginBottom: "10px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>No Active Job Postings</h3>
              <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px", fontSize: "13px" }}>
                {isEmployer
                  ? "Be the first employer to post a role. Postings require passing a short technical expectation audit."
                  : "No active verified job postings at the moment. Check back soon!"}
              </p>
              {isEmployer && (
                <button className="btn btn-primary" onClick={() => setActiveView("post")}>
                  Post a Role
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {jobs.map((job) => {
                const isApplied = appliedJobs.has(job.id);
                const isJustApplied = applySuccessId === job.id;
                const hasTrialRepo = Boolean(job.trial_repo_url?.trim());

                return (
                  <div key={job.id} className="job-card">
                    <div className="job-header-row">
                      <div>
                        <h3 className="job-title">{job.role_title}</h3>
                        <span className="job-company">{job.company_name}</span>
                      </div>

                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {hasTrialRepo && (
                          <span className="badge badge-accent">
                            <ShieldLockIcon size={11} />
                            Day-1 Readiness Test Required
                          </span>
                        )}
                        <span className="badge badge-cream">
                          <CheckCircleIcon size={11} />
                          Verified Posting
                        </span>
                      </div>
                    </div>

                    <p className="job-desc">{job.description}</p>

                    {hasTrialRepo && (
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileCodeIcon size={13} style={{ color: "var(--accent)" }} />
                        <span>Attached Trial Codebase: <code style={{ color: "var(--accent)", fontSize: "11px" }}>{job.trial_repo_url}</code></span>
                      </div>
                    )}

                    {Array.isArray(job.tech_stack) && job.tech_stack.length > 0 && (
                      <div className="tech-tag-row">
                        {job.tech_stack.map((tag, i) => (
                          <span key={i} className="tech-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--mist-border-light)", paddingTop: "12px", marginTop: "2px", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
                        {job.posted_at
                          ? `Posted ${new Date(job.posted_at).toLocaleDateString()}`
                          : "Active opportunity"}
                      </span>

                      <button
                        className={`btn ${isApplied ? "btn-secondary" : "btn-primary"} btn-sm`}
                        onClick={() => handleApply(job)}
                        disabled={isApplied || applyingJobId === job.id}
                      >
                        {isJustApplied ? (
                          <>
                            <CheckCircleIcon size={13} style={{ color: "var(--success)" }} />
                            <span>Application Sent</span>
                          </>
                        ) : isApplied ? (
                          <span>Applied</span>
                        ) : applyingJobId === job.id ? (
                          <span>Sending Application...</span>
                        ) : hasTrialRepo ? (
                          <>
                            <ClockIcon size={13} />
                            <span>Take Day-1 Test & Apply</span>
                          </>
                        ) : (
                          <span>1-Click Apply with Profile</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Employer Gated Post Flow (Full Company Quiz) */}
      {!activeDay1Job && !day1ApplicationResult && activeView === "post" && (
        <PostJobPage
          onUnauthorized={onUnauthorized}
          onCancel={() => setActiveView("browse")}
          onViewJobs={() => {
            loadJobs();
            setActiveView("browse");
          }}
        />
      )}

      {/* VIEW 3: Employer Applicants Review Dashboard */}
      {!activeDay1Job && !day1ApplicationResult && activeView === "applicants" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {appsLoading ? (
            <div className="card" style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading incoming candidate applications...</p>
            </div>
          ) : employerApps.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <UserIcon size={32} style={{ color: "var(--text-subtle)", marginBottom: "10px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>No Candidate Applications Yet</h3>
              <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px", fontSize: "13px" }}>
                When engineers apply with their comprehension profiles and Day-1 test scores, they will appear here for review.
              </p>
              <button className="btn btn-secondary" onClick={() => setActiveView("browse")}>
                Browse Active Roles
              </button>
            </div>
          ) : (
            employerApps.map((app) => {
              const isUpdating = updatingAppId === app.id;
              return (
                <div key={app.id} className="card" style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Avatar
                        name={app.candidate_name}
                        size="md"
                        revealed={app.revealed}
                        role="candidate"
                        showBadge
                      />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-main)" }}>
                            {app.candidate_name}
                          </h3>
                          {app.revealed ? (
                            <span className="badge badge-success">
                              <CheckCircleIcon size={10} />
                              Identity Revealed
                            </span>
                          ) : (
                            <span className="badge badge-cream">
                              <ShieldLockIcon size={10} />
                              Anonymous Pseudonym
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                          Applying for: <strong>{app.role_title}</strong> · {app.company_name}
                        </p>
                        {app.candidate_email && (
                          <span style={{ fontSize: "12px", color: "var(--accent)", fontFamily: "monospace" }}>
                            {app.candidate_email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        className="badge"
                        style={{
                          textTransform: "capitalize",
                          fontWeight: "700",
                          backgroundColor:
                            app.status === "accepted"
                              ? "var(--success-bg)"
                              : app.status === "reviewed"
                              ? "var(--mist)"
                              : app.status === "rejected"
                              ? "var(--danger-bg)"
                              : "var(--surface-sunken)",
                          color:
                            app.status === "accepted"
                              ? "var(--success-text)"
                              : app.status === "reviewed"
                              ? "var(--navy)"
                              : app.status === "rejected"
                              ? "var(--danger-text)"
                              : "var(--text-muted)",
                        }}
                      >
                        Status: {app.status}
                      </span>
                    </div>
                  </div>

                  {/* Candidate Metrics Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", margin: "12px 0", background: "var(--surface-sunken)", padding: "12px 14px", borderRadius: "8px" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-subtle)", display: "block" }}>Candidate Repo Comprehension</span>
                      <strong style={{ fontSize: "16px", color: app.comprehension_score !== null ? "var(--text-main)" : "var(--text-dim)" }}>
                        {app.comprehension_score !== null ? `${app.comprehension_score} / 100` : "Unrated"}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-subtle)", display: "block" }}>Day-1 Readiness Score (Trial Repo)</span>
                      <strong style={{ fontSize: "16px", color: app.day1_score !== null ? "var(--accent)" : "var(--text-dim)" }}>
                        {app.day1_score !== null ? `${app.day1_score} / 100` : "N/A"}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-subtle)", display: "block" }}>Applied On</span>
                      <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                        {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "Recent"}
                      </span>
                    </div>
                  </div>

                  {/* Employer Decision Actions */}
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", borderTop: "1px solid var(--mist-border-light)", paddingTop: "12px", marginTop: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-subtle)", marginRight: "auto" }}>
                      Update candidate review stage:
                    </span>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleUpdateStatus(app.id, "reviewed")}
                      disabled={isUpdating || app.status === "reviewed"}
                    >
                      <span>Mark Reviewed</span>
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      style={{ backgroundColor: "var(--success)", borderColor: "var(--success)" }}
                      onClick={() => handleUpdateStatus(app.id, "accepted")}
                      disabled={isUpdating || app.status === "accepted"}
                    >
                      <CheckCircleIcon size={12} />
                      <span>Accept / Shortlist</span>
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: "var(--danger)" }}
                      onClick={() => handleUpdateStatus(app.id, "rejected")}
                      disabled={isUpdating || app.status === "rejected"}
                    >
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 4: Candidate My Applications Tracker */}
      {!activeDay1Job && !day1ApplicationResult && activeView === "my-applications" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {candAppsLoading ? (
            <div className="card" style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading your submitted applications...</p>
            </div>
          ) : candidateApps.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <FileCodeIcon size={32} style={{ color: "var(--text-subtle)", marginBottom: "10px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>No Active Applications</h3>
              <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px", fontSize: "13px" }}>
                Browse verified engineering roles and apply with your defended repository comprehension profile.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveView("browse")}>
                Browse Roles
              </button>
            </div>
          ) : (
            candidateApps.map((app) => (
              <div key={app.id} className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)" }}>
                      {app.role_title}
                    </h3>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>
                      {app.company_name}
                    </span>
                  </div>

                  <span
                    className="badge"
                    style={{
                      textTransform: "capitalize",
                      fontWeight: "700",
                      backgroundColor:
                        app.status === "accepted"
                          ? "var(--success-bg)"
                          : app.status === "reviewed"
                          ? "var(--mist)"
                          : app.status === "rejected"
                          ? "var(--danger-bg)"
                          : "var(--surface-sunken)",
                      color:
                        app.status === "accepted"
                          ? "var(--success-text)"
                          : app.status === "reviewed"
                          ? "var(--navy)"
                          : app.status === "rejected"
                          ? "var(--danger-text)"
                          : "var(--text-muted)",
                    }}
                  >
                    Status: {app.status}
                  </span>
                </div>

                {app.trial_repo_url && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileCodeIcon size={13} style={{ color: "var(--accent)" }} />
                    <span>Tested Codebase: <code style={{ color: "var(--accent)", fontSize: "11px" }}>{app.trial_repo_url}</code></span>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--mist-border-light)", paddingTop: "12px", marginTop: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                    {app.day1_score !== null && app.day1_score !== undefined && (
                      <span>Day-1 Readiness Score: <strong style={{ color: "var(--accent)" }}>{app.day1_score} / 100</strong></span>
                    )}
                    <span style={{ color: "var(--text-subtle)" }}>
                      Submitted {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "recently"}
                    </span>
                  </div>

                  <span className="badge badge-mist">
                    {app.status === "applied" ? "Awaiting Employer Review" : "Progressed in Funnel"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

