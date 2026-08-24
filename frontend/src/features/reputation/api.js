import request from "../../shared/api/client";

// Open on the backend, like the profile read: the payload carries no identity,
// only what the candidate has demonstrated.
export function getReputation(userId) {
  return request(`/users/${encodeURIComponent(userId)}/reputation`);
}
