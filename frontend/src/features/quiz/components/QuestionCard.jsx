export default function QuestionCard({ question, answer, onAnswerChange }) {
  return (
    <div className="question">
      <p>
        <strong>{question.question}</strong>
        {question.file_reference && <span className="ref"> ({question.file_reference})</span>}
      </p>
      <textarea
        value={answer || ""}
        onChange={(e) => onAnswerChange(question.id, e.target.value)}
        placeholder="Your answer..."
      />
    </div>
  );
}
