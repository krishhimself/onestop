import request from "../../shared/api/client";
import { clearToken, getToken, setToken } from "../../shared/api/token";

async function authenticate(path, body) {
  const data = await request(path, { method: "POST", body: JSON.stringify(body) });
  setToken(data.access_token);
  return data;
}

export function register(name, email, password, role = "candidate") {
  return authenticate("/auth/register", { name, email, password, role });
}

export function login(email, password) {
  return authenticate("/auth/login", { email, password });
}

export function logout() {
  clearToken();
}

export function isLoggedIn() {
  return Boolean(getToken());
}
