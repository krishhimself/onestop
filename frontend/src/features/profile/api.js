import request from "../../shared/api/client";

// Open on the backend: an employer can read a profile before either side has
// committed to anything, which is the point of the funnel. The token is still
// attached by the client when one exists.
export function getProfile(userId) {
  return request(`/profile/${encodeURIComponent(userId)}`);
}
