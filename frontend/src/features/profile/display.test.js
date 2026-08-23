import test from "node:test";
import assert from "node:assert/strict";
import { displayName, ANONYMOUS_NAME } from "./display.js";

test("an unrevealed profile shows the pseudonym", () => {
  assert.equal(displayName({ revealed: false, name: null, email: null }), ANONYMOUS_NAME);
});

test("a revealed profile shows the real name", () => {
  assert.equal(displayName({ revealed: true, name: "Ada Lovelace", email: "ada@x.com" }), "Ada Lovelace");
});

test("a revealed profile with no name falls back to the email", () => {
  assert.equal(displayName({ revealed: true, name: null, email: "ada@x.com" }), "ada@x.com");
});

test("identity in an unrevealed payload is still not rendered", () => {
  // The server should never send this. If it ever did, the UI must not be the
  // thing that leaks it.
  assert.equal(displayName({ revealed: false, name: "Ada Lovelace", email: "ada@x.com" }), ANONYMOUS_NAME);
});

test("a missing profile shows the pseudonym rather than throwing", () => {
  assert.equal(displayName(undefined), ANONYMOUS_NAME);
  assert.equal(displayName(null), ANONYMOUS_NAME);
});
