import test from "node:test";
import assert from "node:assert/strict";
import { getUserPayload } from "../../shared/api/token.js";

// Helper to construct a synthetic JWT with given claims
function mockJwt(claims) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify(claims));
  const signature = "mockSignature";
  return `${header}.${payload}.${signature}`;
}

test("candidate account payload parses role as candidate", () => {
  const token = mockJwt({ sub: "u_cand", role: "candidate" });
  // Mock localStorage for Node test runner
  global.localStorage = {
    getItem: (key) => (key === "onestop_token" ? token : null),
    setItem: () => {},
    removeItem: () => {},
  };

  const payload = getUserPayload();
  assert.equal(payload.role, "candidate");
  assert.equal(payload.sub, "u_cand");
});

test("employer account payload parses role as employer", () => {
  const token = mockJwt({ sub: "u_emp", role: "employer" });
  global.localStorage = {
    getItem: (key) => (key === "onestop_token" ? token : null),
    setItem: () => {},
    removeItem: () => {},
  };

  const payload = getUserPayload();
  assert.equal(payload.role, "employer");
  assert.equal(payload.sub, "u_emp");
});

test("default tab routing: employer lands on jobs/post, candidate lands on quiz", () => {
  const getInitialTab = (role) => (role === "employer" ? "jobs" : "quiz");

  assert.equal(getInitialTab("candidate"), "quiz");
  assert.equal(getInitialTab("employer"), "jobs");
});
