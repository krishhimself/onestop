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

function claim(name) {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json)[name] ?? null;
  } catch {
    return null; // malformed token - treat it as no session rather than crashing
  }
}

export function getUserId() {
  // The `sub` claim, read straight off the token payload. Reading it here saves a
  // round trip for "whose profile am I looking at by default" — it is not a
  // security decision, and nothing here verifies the signature. Every claim that
  // matters is re-checked by the backend against the signed token.
  return claim("sub");
}

export function getRole() {
  // Decides which tabs to render, nothing more. The backend re-checks the role
  // against the signed token on every employer-only route, so editing this in a
  // console buys a form that the API refuses.
  return claim("role");
}
