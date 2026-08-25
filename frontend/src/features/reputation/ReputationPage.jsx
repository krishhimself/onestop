import { useEffect, useState } from "react";
import { getReputation } from "./api";
import { getUserId } from "../../shared/api/token";

/**
 * The reputation breakdown, as its own component.
 *
 * Invariant, same as ScoreResult and PostingResult: the components render in this
 * component's single return, so the overall figure cannot appear anywhere without
 * the three numbers it was computed from. A blended score on its own gets read as
 * a measure of engineering ability, and an average of 92 across one quiz is not
 * the same claim as 92 across six — the quiz count is what says so.
 *
 * Deliberately not folded into the quiz result view: that view is about one
 * attempt on one repo, this is about a history. It renders inside ProfilePage,
 * which owns identity; this owns what was demonstrated.
 */

// [key, label, how to read it]. Sentence-case labels, no trailing colons.
const COMPONENTS = [
  ["comprehension", "Comprehension", "Mean of every defended quiz score."],
  ["quiz_count", "Quizzes defended", "Attempts that survived a follow-up round."],
  ["rounds_reached", "Rounds reached", "Applications that moved past the pile."],
];

export default function ReputationPage({ userId, onUnauthorized }) {
  const subject = userId ?? getUserId();
  const [score, setScore] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    if (!subject) {
      setError("No reputation to show.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getReputation(subject)
      .then((data) => live && setScore(data))
      .catch((e) => {
        if (!live) return;
        if (e.status === 401) return onUnauthorized?.();
        setError(e.message);
      })
      .finally(() => live && setLoading(false));
    // Ignore a response that arrives after the subject changed or the page left.
    return () => {
      live = false;
    };
  }, [subject]);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading reputation...</p>
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

  const fresh = score.quiz_count === 0 && score.rounds_reached === 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)" }}>
            Reputation
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            What you have demonstrated here, and what happened when you applied.
          </p>
        </div>
        <span className="badge badge-accent">Multi-Signal Audit</span>
      </div>

      <div className="result-hero-card" style={{ marginBottom: "12px" }}>
        <div className="score-gauge-wrap">
          <div className="score-circle" style={{ borderColor: "var(--accent)" }}>
            <span className="score-num">{score.overall}</span>
            <span className="score-max">/ 100</span>
          </div>
        </div>

        <div className="result-hero-info">
          <h2 className="result-headline">Overall</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
            {fresh
              ? "Nothing here yet — this is what a new account looks like, not a failing one. Defend a repo quiz and the first number moves."
              : "Comprehension is three quarters of the overall figure and rounds reached is the rest, capped so that volume of applications cannot substitute for understanding."}
          </p>
        </div>
      </div>

      <div className="reputation-grid">
        {COMPONENTS.map(([key, label, hint]) => (
          <div key={key} className="rep-stat-card">
            <span className="rep-stat-label">{label}</span>
            <span className="rep-stat-value" style={{ color: "var(--text-main)" }}>
              {score[key]}
            </span>
            <p className="rep-stat-desc">{hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
