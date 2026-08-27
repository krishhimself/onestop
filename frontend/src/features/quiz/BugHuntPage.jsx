import React, { useState } from "react";
import RepoInput from "./components/RepoInput";
import BugHuntWorkspace from "./components/BugHuntWorkspace";
import BugHuntResult from "./components/BugHuntResult";
import { generateBugHunt, submitBugHunt } from "./api";

export default function BugHuntPage({
  onUnauthorized,
  onNavigateReputation,
  initialRepoUrl = "",
}) {
  const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
  const [challenge, setChallenge] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate(urlOverride) {
    const targetUrl = urlOverride || repoUrl;
    if (!targetUrl.trim()) {
      setError("Please enter a valid public GitHub repository URL.");
      return;
    }

    setLoading(true);
    setError("");
    setChallenge(null);
    setResult(null);

    try {
      const data = await generateBugHunt(targetUrl.trim());
      setChallenge(data);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(
        e.message ||
          "Couldn't read source files from that repository — make sure it's public."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(findings) {
    if (!challenge?.bug_hunt_id) return;
    setLoading(true);
    setError("");

    try {
      const resultData = await submitBugHunt(challenge.bug_hunt_id, findings);
      setResult(resultData);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Failed to submit and grade Bug Hunt findings.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setChallenge(null);
    setResult(null);
    setError("");
  }

  return (
    <div className="quiz-container">
      {/* Top Hero Banner */}
      <div className="page-hero">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h1 className="page-hero-title">
            Bug Hunt Mode
          </h1>
          <span className="badge badge-accent">Code Integrity Challenge</span>
        </div>
        <p className="page-hero-desc">
          We inject 2–3 subtle, realistic logic bugs into copies of your repository source files.
          Inspect the buggy code, identify the root cause, and explain the failure behavior under a countdown clock.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* 1. Repo Input Step */}
      {!challenge && !result && (
        <RepoInput
          value={repoUrl}
          onChange={setRepoUrl}
          onSubmit={() => handleGenerate()}
          loading={loading}
          title="Bug Hunt Codebase Injection"
          description="Enter your public repository URL. Gemini will inject 2–3 realistic semantic bugs (off-by-one, inverted branches, edge cases, state leaks) into working copies of your code and test how quickly you pinpoint them."
          submitLabel="Start Bug Hunt Challenge"
          loadingLabel="Injecting Subtle Bugs..."
        />
      )}

      {/* 2. Interactive Bug Hunt Workspace */}
      {challenge && !result && (
        <BugHuntWorkspace
          challenge={challenge}
          onSubmit={handleSubmit}
          busy={loading}
        />
      )}

      {/* 3. Bug Hunt Evaluation Results */}
      {result && (
        <BugHuntResult
          result={result}
          onRestart={handleReset}
          onNavigateReputation={onNavigateReputation}
        />
      )}
    </div>
  );
}
