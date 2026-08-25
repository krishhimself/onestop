import { useEffect, useState } from "react";
import { fetchJobs, applyToJob } from "./api";
import { getUserId, getUserRole } from "../../shared/api/token";
// The posting flow is not implemented here on purpose. A job exists only as the
// output of a defended company quiz, and PostJobPage is what drives that round;
// anything in this file that created a posting would be a second way in.
import PostJobPage from "./PostJobPage";
import {
  JobsIcon,
  CheckCircleIcon,
  ShieldLockIcon,
  PlusIcon,
} from "../../shared/components/Icons";

export default function JobsPage({ onUnauthorized, userProfile }) {
  const userId = getUserId();
  const role = userProfile?.role || getUserRole() || "candidate";
  // The company-quiz routes require an employer token, so a candidate clicking
  // through to the posting round would only reach a 403.
  const isEmployer = role === "employer";

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("browse"); // "browse" | "post"

  // Application State
  const [appliedJobs, setAppliedJobs] = useState(() => new Set());
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [applySuccessId, setApplySuccessId] = useState(null);

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

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleApply(jobId) {
    if (!userId) return onUnauthorized?.();
    setApplyingJobId(jobId);
    try {
      await applyToJob(jobId, userId);
      setAppliedJobs((prev) => new Set(prev).add(jobId));
      setApplySuccessId(jobId);
      setTimeout(() => setApplySuccessId(null), 4000);
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      alert("Application failed: " + err.message);
    } finally {
      setApplyingJobId(null);
    }
  }

  return (
    <div className="jobs-container">
      {/* Top Header */}
      <div className="page-hero">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
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

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className={`btn ${activeView === "browse" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveView("browse")}
            >
              <JobsIcon size={14} />
              <span>Browse Roles ({jobs.length})</span>
            </button>

            {isEmployer && (
              <button
                className={`btn ${activeView === "post" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveView("post")}
              >
                <PlusIcon size={14} />
                <span>Post a Role</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* VIEW 1: Browse Jobs */}
      {activeView === "browse" && (
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
                A posting only appears here once an employer has written it and defended
                it under the clock. Nothing else creates one.
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

                return (
                  <div key={job.id} className="job-card">
                    <div className="job-header-row">
                      <div>
                        <h3 className="job-title">{job.role_title}</h3>
                        <span className="job-company">{job.company_name}</span>
                      </div>

                      <span className="badge badge-cream">
                        <CheckCircleIcon size={11} />
                        Verified Posting
                      </span>
                    </div>

                    <p className="job-desc">{job.description}</p>

                    {Array.isArray(job.tech_stack) && job.tech_stack.length > 0 && (
                      <div className="tech-tag-row">
                        {job.tech_stack.map((tag, i) => (
                          <span key={i} className="tech-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--mist-border-light)", paddingTop: "12px", marginTop: "2px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
                        {job.posted_at
                          ? `Posted ${new Date(job.posted_at).toLocaleDateString()}`
                          : "Active opportunity"}
                      </span>

                      <button
                        className={`btn ${isApplied ? "btn-secondary" : "btn-primary"} btn-sm`}
                        onClick={() => handleApply(job.id)}
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

      {/* VIEW 2: the real gate — draft, defend, publish on a pass */}
      {activeView === "post" && (
        isEmployer ? (
          <PostJobPage
            onUnauthorized={onUnauthorized}
            onPublished={loadJobs}
            onCancel={() => setActiveView("browse")}
          />
        ) : (
          <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
            <ShieldLockIcon size={32} style={{ color: "var(--text-subtle)", marginBottom: "10px" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>
              Employer accounts only
            </h3>
            <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px", fontSize: "13px" }}>
              The posting round runs against an employer token. Register as an employer
              to write a posting and answer for it.
            </p>
            <button className="btn btn-secondary" onClick={() => setActiveView("browse")}>
              Back to Roles
            </button>
          </div>
        )
      )}

    </div>
  );
}
