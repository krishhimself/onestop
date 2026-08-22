export default function ScoreResult({ result }) {
  return (
    <div className="result">
      <h2>Score: {result.score}/100</h2>
      {result.feedback.map((f, i) => (
        <div key={i} className="feedback-item">
          <p className="q">{f.question}</p>
          <p className="s">
            {f.score}/10 — {f.note}
          </p>
        </div>
      ))}
    </div>
  );
}
