import request from "../../shared/api/client";

// Open to read, like the profile and reputation views. Writing attaches the
// token, and the backend takes the author from it rather than from the body.
export function fetchPosts(limit = 20, skip = 0) {
  return request(`/posts/?limit=${limit}&skip=${skip}`);
}

export function createPost({ text, jobId, companyName }) {
  return request("/posts/", {
    method: "POST",
    body: JSON.stringify({
      text,
      job_id: jobId || null,
      company_name: companyName || null,
    }),
  });
}

// Instant and mutual — there is nothing to accept, so there is no second call.
// Connecting again is a no-op that comes back with created: false.
export function connectTo(userId) {
  return request(`/users/${encodeURIComponent(userId)}/connect`, { method: "POST" });
}

export function fetchConnections(userId) {
  return request(`/users/${encodeURIComponent(userId)}/connections`);
}
