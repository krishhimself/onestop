// Invariant: the headline score is never rendered on its own. The complexity
// label and the per-question breakdown are part of this component's single
// return, so a bare "82/100" cannot appear anywhere in the UI. If you add
// another score surface, render it through here rather than reading
// result.score directly.
export default function ScoreResult({ result, complexity }) {
  const tier = complexity?.tier;
  const tierLabel = !tier ? null : tier === "unknown" ? "unrated" : tier;
  const feedback = Array.isArray(result?.feedback) ? result.feedback : [];

  return (
    <div className="result">
      <h2 className="headline">
        Comprehension: {result.score}/100
        {tierLabel && (
          <>
            {" · "}
            <span className="complexity">Project complexity: {tierLabel}</span>
          </>
        )}
      </h2>

      {complexity?.reasoning && <p className="complexity-why">{complexity.reasoning}</p>}

      {feedback.length > 0 ? (
        feedback.map((f, i) => (
          <div key={i} className="feedback-item">
            <p className="q">{f.question}</p>
            <p className="s">
              {f.score}/10 — {f.note}
            </p>
          </div>
        ))
      ) : (
        <p className="s">No per-question breakdown was returned for this attempt.</p>
      )}
    </div>
  );
}
