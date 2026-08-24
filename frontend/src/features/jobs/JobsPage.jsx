import { useEffect, useState } from "react";
import { fetchJobs, createJob, applyToJob } from "./api";
import { getUserId, getUserRole } from "../../shared/api/token";
import QuestionCard from "../quiz/components/QuestionCard";
import {
  JobsIcon,
  CheckCircleIcon,
  ShieldLockIcon,
  PlusIcon,
} from "../../shared/components/Icons";

const COMPANY_VERIFICATION_QUESTIONS = [
  {
    id: "q_comp_1",
    question: "What specific architectural patterns or concurrency models does this role interact with daily?",
    category: "Architecture Reality",
    file_reference: "production_stack",
  },
  {
    id: "q_comp_2",
    question: "What is the primary failure mode or technical debt in the repository this hire will be fixing?",
    category: "Day-to-day Reality",
    file_reference: "system_architecture",
  },
];

export default function JobsPage({ onUnauthorized, userProfile }) {
  const userId = getUserId();
  const role = userProfile?.role || getUserRole() || "candidate";

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("browse"); // "browse" | "post"

  // Employer Gated Post Form State
  const [step, setStep] = useState("verify"); // "verify" | "compose" | "published"
  const [verificationAnswers, setVerificationAnswers] = useState({});
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStackInput, setTechStackInput] = useState("");
  const [postingBusy, setPostingBusy] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

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

  async function handlePostJob(e) {
    e.preventDefault();
    setPostingBusy(true);
    setError("");
    try {
      const techStack = techStackInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await createJob({
        company_name: companyName.trim(),
        role_title: roleTitle.trim(),
        description: description.trim(),
        tech_stack: techStack,
      });

      setPostSuccess(true);
      setStep("published");
      await loadJobs();
    } catch (err) {
      if (err.status === 401) return onUnauthorized?.();
      setError(err.message || "Failed to create job posting.");
    } finally {
      setPostingBusy(false);
    }
  }

  function handleResetPost() {
    setStep("verify");
    setVerificationAnswers({});
    setCompanyName("");
    setRoleTitle("");
    setDescription("");
    setTechStackInput("");
    setPostSuccess(false);
    setActiveView("browse");
  }

  const isVerificationComplete =
    COMPANY_VERIFICATION_QUESTIONS.every((q) => (verificationAnswers[q.id] || "").trim().length > 10);

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

            <button
              className={`btn ${activeView === "post" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveView("post")}
            >
              <PlusIcon size={14} />
              <span>Employer: Post Role</span>
            </button>
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
                Be the first employer to post a role. Postings require passing a short technical expectation audit.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveView("post")}>
                Post a Role
              </button>
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

      {/* VIEW 2: Employer Gated Post Flow */}
      {activeView === "post" && (
        <div className="card" style={{ padding: "24px" }}>
          {step === "verify" && (
            <div>
              <div className="badge badge-accent" style={{ marginBottom: "10px" }}>
                <ShieldLockIcon size={12} />
                Step 1: Role Verification Gating
              </div>

              <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "4px" }}>
                Company-Side Technical Audit
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "18px", lineHeight: "1.5" }}>
                Just as candidates defend their repos, OneStop gates job creation behind an architectural verification check to ensure postings reflect real engineering requirements rather than generic recruiter copy.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "18px" }}>
                {COMPANY_VERIFICATION_QUESTIONS.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    answer={verificationAnswers[q.id] || ""}
                    timeLimit={120}
                    onAnswerChange={(id, val) =>
                      setVerificationAnswers((prev) => ({ ...prev, [id]: val }))
                    }
                  />
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button className="btn btn-secondary" onClick={() => setActiveView("browse")}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!isVerificationComplete}
                  onClick={() => setStep("compose")}
                >
                  <span>Verification Complete: Unlock Form</span>
                  <CheckCircleIcon size={14} />
                </button>
              </div>
            </div>
          )}

          {step === "compose" && (
            <form onSubmit={handlePostJob}>
              <div className="badge badge-success" style={{ marginBottom: "10px" }}>
                <CheckCircleIcon size={12} />
                Step 2: Role Details
              </div>

              <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "4px" }}>
                Publish Verified Job Listing
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "18px" }}>
                Your technical verification has been confirmed. Enter the public posting details below.
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="job-company">
                  Company Name
                </label>
                <input
                  id="job-company"
                  className="input-field"
                  placeholder="e.g. Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="job-title">
                  Role Title
                </label>
                <input
                  id="job-title"
                  className="input-field"
                  placeholder="e.g. Senior Backend Engineer (Distributed Systems)"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="job-stack">
                  Primary Tech Stack (comma separated)
                </label>
                <input
                  id="job-stack"
                  className="input-field"
                  placeholder="e.g. Python, FastAPI, PostgreSQL, Redis, Docker"
                  value={techStackInput}
                  onChange={(e) => setTechStackInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="job-desc">
                  Role Description & Technical Responsibilities
                </label>
                <textarea
                  id="job-desc"
                  className="textarea-field"
                  style={{ minHeight: "110px" }}
                  placeholder="Detail what this engineer will build, key systems owned, and expectations..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep("verify")}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={postingBusy || !companyName.trim() || !roleTitle.trim() || !description.trim()}
                >
                  {postingBusy ? "Publishing..." : "Publish Verified Role"}
                </button>
              </div>
            </form>
          )}

          {step === "published" && (
            <div style={{ textAlign: "center", padding: "36px 10px" }}>
              <CheckCircleIcon size={36} style={{ color: "var(--success)", marginBottom: "10px" }} />
              <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}>
                Job Successfully Published
              </h2>
              <p style={{ color: "var(--text-muted)", maxWidth: "440px", margin: "0 auto 18px", fontSize: "13px" }}>
                Candidates with verified repository comprehension scores can now discover and apply to your role.
              </p>
              <button className="btn btn-primary" onClick={handleResetPost}>
                View Active Listings
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
