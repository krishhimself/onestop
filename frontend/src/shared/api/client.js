// Only file that should call fetch() directly against the backend.
// Feature api.js files (e.g. features/quiz/api.js) call this instead
// of using fetch inline.
import { clearToken, getToken } from "./token";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export default async function request(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // Attached automatically so no feature has to remember to do it.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    // An expired or rejected token should drop the session rather than leave the
    // UI insisting it is logged in while every call 401s.
    if (res.status === 401) clearToken();
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || "Request failed", res.status);
  }
  return res.json();
}
