export default function RepoInput({ value, onChange, onSubmit, loading }) {
  return (
    <div className="row">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://github.com/username/repo"
      />
      <button onClick={onSubmit} disabled={loading || !value}>
        {loading ? "Reading repo..." : "Generate Quiz"}
      </button>
    </div>
  );
}
