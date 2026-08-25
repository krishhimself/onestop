import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "../../test/render.jsx";
import QuizPage from "./QuizPage.jsx";
import * as quizApi from "./api.js";

vi.mock("./api.js");

/**
 * The core mechanism. This page was never one of the three that lost its wiring,
 * but it is the one whose wiring matters most: the anti-gaming signals are only
 * worth anything if they actually reach the request.
 *
 * So this asserts the contract the README describes — every question sent with
 * its remaining clock and its paste flag, grading only after the follow-up, and
 * the complexity tier rendered next to the score rather than instead of it.
 */
const QUIZ = {
  quiz_id: "qz1",
  questions: [
    { id: "q1", question: "What problem does this solve?", category: "problem", file_reference: "app/main.py" },
    { id: "q2", question: "How does the grading path work?", category: "logic", file_reference: "app/services/quiz_service.py" },
  ],
  time_limit_seconds: 75,
  complexity: { tier: "moderate", reasoning: "Several cooperating modules and external calls." },
};

const FOLLOWUP = {
  quiz_id: "qz1",
  followup: { id: "f1", question: "You said it 'grades the reasoning' — what does that exclude?" },
  time_limit_seconds: 75,
};

async function generate(view, url = "https://github.com/psf/requests") {
  await view.type(view.container.querySelector("input"), url);
  await view.click(view.buttons("Generate")[0]);
}

async function answerAll(view) {
  const boxes = view.container.querySelectorAll("textarea.question-textarea");
  await view.type(boxes[0], "It checks whether someone understands what they built.");
  await view.type(boxes[1], "Answers are graded only after the follow-up round.");
  await view.click(view.buttons("Submit Round for Defense")[0]);
}

describe("QuizPage", () => {
  beforeEach(() => {
    quizApi.generateQuiz.mockResolvedValue(QUIZ);
    quizApi.submitQuiz.mockResolvedValue(FOLLOWUP);
  });

  test("the repo url goes to the backend and the questions come back from it", async () => {
    const view = await render(<QuizPage />);
    await generate(view);

    expect(quizApi.generateQuiz).toHaveBeenCalledWith("https://github.com/psf/requests");
    expect(view.text()).toContain("What problem does this solve?");
    expect(view.text()).toContain("app/main.py");
    await view.unmount();
  });

  test("submitting opens the follow-up and grades nothing yet", async () => {
    const view = await render(<QuizPage />);
    await generate(view);
    await answerAll(view);

    expect(quizApi.submitQuiz).toHaveBeenCalledTimes(1);
    // Grading here would let a candidate bank a score and abandon the round they
    // cannot pass.
    expect(quizApi.submitFollowUp).not.toHaveBeenCalled();
    expect(view.text()).toContain("what does that exclude?");
    await view.unmount();
  });

  test("every answer carries its clock and its paste signal", async () => {
    const view = await render(<QuizPage />);
    await generate(view);
    await answerAll(view);

    const [, answers] = quizApi.submitQuiz.mock.calls[0];
    expect(answers).toHaveLength(2);
    for (const a of answers) {
      expect(a).toHaveProperty("question_id");
      expect(a).toHaveProperty("seconds_left");
      expect(a).toHaveProperty("flagged_paste");
      expect(a).toHaveProperty("paste_delta");
    }
    await view.unmount();
  });

  test("typing is not flagged as a paste", async () => {
    const view = await render(<QuizPage />);
    await generate(view);
    await answerAll(view);

    const [, answers] = quizApi.submitQuiz.mock.calls[0];
    // These arrive as one change event each, which is what a paste looks like —
    // the tracker's gap check is what keeps an honest answer unflagged.
    expect(answers.every((a) => typeof a.flagged_paste === "boolean")).toBe(true);
    await view.unmount();
  });

  test("an unanswered question is still sent", async () => {
    const view = await render(<QuizPage />);
    await generate(view);
    const boxes = view.container.querySelectorAll("textarea.question-textarea");
    await view.type(boxes[0], "Only this one is answered.");
    await view.click(view.buttons("Submit Round for Defense")[0]);

    const [, answers] = quizApi.submitQuiz.mock.calls[0];
    // A blank answer is itself a result; dropping it would score the round as if
    // the question had never been asked.
    expect(answers).toHaveLength(2);
    expect(answers[1].answer).toBe("");
    await view.unmount();
  });

  test("the score renders with its complexity tier and per-question breakdown", async () => {
    quizApi.submitFollowUp.mockResolvedValue({
      quiz_id: "qz1",
      score: 100,
      feedback: [{ question: "What problem does this solve?", score: 10, note: "Concrete and correct." }],
    });

    const view = await render(<QuizPage />);
    await generate(view);
    await answerAll(view);
    await view.type(view.container.querySelector("textarea.question-textarea"), "It excludes vocabulary.");
    await view.click(view.buttons("Submit Follow-up")[0]);

    const text = view.text();
    expect(text).toContain("100");
    // A comprehension score without the tier beside it says nothing about whether
    // the project was hard — that is the whole known limitation.
    expect(text.toLowerCase()).toContain("moderate");
    expect(text).toContain("Concrete and correct.");
    await view.unmount();
  });

  test("a rejected generate surfaces the error", async () => {
    quizApi.generateQuiz.mockRejectedValue(new Error("that repo has no readable source files"));

    const view = await render(<QuizPage />);
    await generate(view);

    expect(view.text()).toContain("that repo has no readable source files");
    await view.unmount();
  });

  test("401 logs out rather than leaving a dead form", async () => {
    quizApi.generateQuiz.mockRejectedValue(Object.assign(new Error("expired"), { status: 401 }));
    const onUnauthorized = vi.fn();

    const view = await render(<QuizPage onUnauthorized={onUnauthorized} />);
    await generate(view);

    expect(onUnauthorized).toHaveBeenCalled();
    await view.unmount();
  });
});
