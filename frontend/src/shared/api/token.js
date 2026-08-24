// Single source of truth for the access token.
//
// Lives in shared/api rather than features/auth because the request client needs
// it too, and importing a feature from shared would invert the layering.
//
// localStorage is readable by any script on the origin, so this is only as safe as
// the app is free of XSS. An httpOnly cookie would be stronger; it needs CSRF
// handling and a same-site story that this stage does not have yet.
const KEY = "onestop_token";

export function getToken() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* non-fatal: the session just will not survive a reload */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

export function getUserId() {
  const payload = getUserPayload();
  return payload?.sub ?? null;
}

export function getUserRole() {
  const payload = getUserPayload();
  return payload?.role ?? "candidate";
}

export function getUserPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null; // malformed token — treat it as no session rather than crashing
  }
}
