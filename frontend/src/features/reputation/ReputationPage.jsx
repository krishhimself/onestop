import { useEffect, useState } from "react";
import { getReputation } from "./api";
import { getUserId } from "../../shared/api/token";

/**
 * The reputation breakdown, as its own page.
 *
 * Invariant, same as ScoreResult and PostingResult: the components render in this
 * component's single return, so the overall figure cannot appear anywhere without
 * the three numbers it was computed from. A blended score on its own gets read as
 * a measure of engineering ability, and an average of 92 across one quiz is not
 * the same claim as 92 across six — the quiz count is what says so.
 *
 * Deliberately not folded into the quiz result view: that view is about one
 * attempt on one repo, this is about a history.
 */

const COMPONENTS = [
  ["comprehension", "Comprehension", "Mean of every defended candidate repo quiz score."],
  ["day1_readiness", "Day-1 Readiness", "Comprehension on unfamiliar codebases from job applications."],
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

  if (loading) return <div className="container">Loading reputation...</div>;
  if (error) return <div className="container"><p className="error">{error}</p></div>;

  const fresh = score.quiz_count === 0 && score.rounds_reached === 0;

  return (
    <div className="container">
      <h1>Reputation</h1>
      <p className="tagline">
        What you have demonstrated here, and what happened when you applied.
      </p>

      <div className="hero">
        <p className="hero-label">Overall</p>
        <p className="hero-value">{score.overall}</p>
        <p className="hero-of">out of 100</p>
      </div>

      <div className="stat-row">
        {COMPONENTS.map(([key, label, hint]) => (
          <div key={key} className="stat">
            <p className="stat-label">{label}</p>
            <p className="stat-value">{score[key]}</p>
            <p className="stat-hint">{hint}</p>
          </div>
        ))}
      </div>

      <p className="rules">
        {fresh
          ? "Nothing here yet — this is what a new account looks like, not a failing one. Defend a repo quiz and the first number moves."
          : "Comprehension is three quarters of the overall figure and rounds reached is the rest, capped so that volume of applications cannot substitute for understanding."}
      </p>
    </div>
  );
}
