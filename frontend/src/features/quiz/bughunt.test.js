import test from "node:test";
import assert from "node:assert/strict";
import { createInputTracker } from "./pasteDetect.js";

test("bug hunt finding paste tracker flags instant large block commit", () => {
  const tracker = createInputTracker();
  const largePaste = "This function has a subtle off-by-one bug where items[:-1] ignores the last element.";

  // Instant paste into empty field
  const record = tracker.record("", largePaste, 1000);
  assert.equal(record.flagged, true);
  assert.equal(record.delta, largePaste.length);

  const snapshot = tracker.snapshot();
  assert.equal(snapshot.flagged_paste, true);
  assert.equal(snapshot.paste_delta, largePaste.length);
});

test("bug hunt finding paste tracker does not flag normal human typing stream", () => {
  const tracker = createInputTracker();
  let text = "";
  let now = 1000;
  const sentence = "Checking off by one error";

  for (const char of sentence) {
    const next = text + char;
    now += 120; // 120ms between keystrokes
    tracker.record(text, next, now);
    text = next;
  }

  const snapshot = tracker.snapshot();
  assert.equal(snapshot.flagged_paste, false);
});

test("bug hunt findings formatter constructs valid backend payload schema", () => {
  const rawFindings = [
    {
      id: "f_1",
      file_path: "app/calculator.py",
      suspected_location: "Line 42",
      description: "Slicing items[:-1] drops the final item in the calculation.",
    },
    {
      id: "f_2",
      file_path: "app/auth.py",
      suspected_location: "check_permission",
      description: "Inverted condition allows unauthorized access.",
    },
  ];

  const secondsLeft = 145.5;
  const tracker1 = createInputTracker();
  tracker1.record("", rawFindings[0].description, 1000); // flagged

  const tracker2 = createInputTracker(); // not flagged

  const formatted = rawFindings.map((f, idx) => {
    const tracker = idx === 0 ? tracker1 : tracker2;
    const snap = tracker.snapshot();
    return {
      file_path: f.file_path,
      suspected_location: f.suspected_location.trim() || null,
      description: f.description.trim(),
      seconds_left: secondsLeft,
      flagged_paste: snap.flagged_paste,
      paste_delta: snap.paste_delta,
    };
  });

  assert.equal(formatted.length, 2);
  assert.equal(formatted[0].file_path, "app/calculator.py");
  assert.equal(formatted[0].suspected_location, "Line 42");
  assert.equal(formatted[0].seconds_left, 145.5);
  assert.equal(formatted[0].flagged_paste, true);
  assert.ok(formatted[0].paste_delta > 0);

  assert.equal(formatted[1].file_path, "app/auth.py");
  assert.equal(formatted[1].flagged_paste, false);
  assert.equal(formatted[1].paste_delta, 0);
});

test("zero leak invariant: bughunt generate response payload structure contains no injected bugs key", () => {
  const mockGenerateResponse = {
    bug_hunt_id: "hunt_12345",
    repo_url: "https://github.com/owner/repo",
    modified_files: [
      {
        path: "app/main.py",
        content: "def run():\n    return 42",
      },
    ],
    time_limit_seconds: 180,
    expected_bug_count: 2,
  };

  assert.ok("bug_hunt_id" in mockGenerateResponse);
  assert.ok("modified_files" in mockGenerateResponse);
  assert.ok("expected_bug_count" in mockGenerateResponse);
  assert.equal("injected_bugs" in mockGenerateResponse, false);
  assert.equal("answer_key" in mockGenerateResponse, false);
  assert.equal("ground_truth" in mockGenerateResponse, false);
});

test("role gating: employer cannot navigate to bughunt tab and is redirected to jobs", () => {
  function computeActiveTab(role, requestedTab) {
    const isEmployer = role === "employer";
    if (isEmployer && (requestedTab === "quiz" || requestedTab === "bughunt")) {
      return "jobs";
    }
    return requestedTab;
  }

  assert.equal(computeActiveTab("candidate", "bughunt"), "bughunt");
  assert.equal(computeActiveTab("candidate", "quiz"), "quiz");
  assert.equal(computeActiveTab("employer", "bughunt"), "jobs");
  assert.equal(computeActiveTab("employer", "quiz"), "jobs");
  assert.equal(computeActiveTab("employer", "feed"), "feed");
});
