import test from "node:test";
import assert from "node:assert/strict";
import { createInputTracker, PASTE_MIN_DELTA, PASTE_MAX_GAP_MS } from "./pasteDetect.js";

/** Replay a stream of [chunk, gapMs] events; "\b" is a backspace. */
function drive(events) {
  const tracker = createInputTracker();
  let text = "";
  let now = 1000;
  for (const [chunk, gap] of events) {
    now += gap;
    const next = chunk === "\b" ? text.slice(0, -1) : text + chunk;
    tracker.record(text, next, now);
    text = next;
  }
  return { ...tracker.snapshot(), text };
}

const typed = (s, gap = 120) => [...s].map((ch) => [ch, gap]);
const PARAGRAPH = "x".repeat(480);

test("a paste into an empty box is flagged", () => {
  const r = drive([[PARAGRAPH, 0]]);
  assert.equal(r.flagged_paste, true);
  assert.equal(r.paste_delta, 480);
});

test("a paste immediately after a keystroke is flagged", () => {
  const r = drive([["hello", 100], ["a", 90], [PARAGRAPH, 30]]);
  assert.equal(r.flagged_paste, true);
});

test("ordinary typing is not flagged", () => {
  const r = drive(typed("a".repeat(240)));
  assert.equal(r.flagged_paste, false);
  assert.equal(r.paste_delta, 0);
  assert.equal(r.text.length, 240);
});

test("typing with the candidate's own backspaces is not flagged", () => {
  const events = [];
  for (let i = 0; i < 200; i++) {
    events.push(["a", 110]);
    if (i % 7 === 0) events.push(["\b", 180]);
  }
  const r = drive(events);
  assert.equal(r.flagged_paste, false);
});

test("a very fast typist is not flagged", () => {
  // Still one character per event, which is what distinguishes typing from paste.
  assert.equal(drive(typed("a".repeat(300), 40)).flagged_paste, false);
});

test("an IME commit after a human pause is not flagged", () => {
  const r = drive(Array.from({ length: 30 }, () => ["abcdefgh", 400]));
  assert.equal(r.flagged_paste, false);
});

test("deleting a large selection is not flagged", () => {
  // A negative delta must never look like an injection.
  const tracker = createInputTracker();
  tracker.record("y".repeat(500), "", 1000);
  assert.equal(tracker.snapshot().flagged_paste, false);
});

test("the largest injection is the one reported", () => {
  const r = drive([["a".repeat(100), 0], ["b", 500], ["c".repeat(300), 20]]);
  assert.equal(r.paste_delta, 300);
});

test("a delta just under the threshold is not flagged", () => {
  const r = drive([["z".repeat(PASTE_MIN_DELTA), 0]]);
  assert.equal(r.flagged_paste, false);
});

test("known gap: pasting after a long pause clears the timing guard", () => {
  // Documents current behaviour rather than endorsing it. Closing this means
  // judging by implied typing rate instead of a fixed gap, which risks flagging
  // dictation software. See the README's anti-gaming section.
  const r = drive([["I think ", 150], ["a", 140], [PARAGRAPH, PASTE_MAX_GAP_MS * 40]]);
  assert.equal(r.flagged_paste, false);
});
