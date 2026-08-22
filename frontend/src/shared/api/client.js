// Only file that should call fetch() directly against the backend.
// Feature api.js files (e.g. features/quiz/api.js) call this instead
// of using fetch inline.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

export default async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Request failed");
  }
  return res.json();
}
