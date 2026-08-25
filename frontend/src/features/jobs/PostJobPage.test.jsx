import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "../../test/render.jsx";
import PostJobPage from "./PostJobPage.jsx";
import * as jobsApi from "./api.js";

vi.mock("./api.js");

/**
 * The employer round, end to end.
 *
 * A posting is the output of this flow and of nothing else, so the properties
 * worth pinning are the ones that make that true: grading only happens after the
 * follow-up, the draft is never re-sent at the end, and a failing score publishes
 * nothing.
 */
const QUIZ = {
  quiz_id: "cq1",
  role_title: "Backend Engineer",
  questions: [
    { id: "q1", question: "Where does Kafka sit in that flow?", category: "stack" },
    { id: "q2", question: "Who decides what gets built?", category: "team" },
  ],
  time_limit_seconds: 75,
};

const FOLLOWUP = {
  quiz_id: "cq1",
  followup: { id: "f1", question: "You said the queue absorbs spikes — what happens when it fills?" },
  time_limit_seconds: 75,
};

const DRAFT = {
  company_name: "Acme",
  role_title: "Backend Engineer",
  description: "Own the ingest pipeline.",
  tech_stack: "Python, FastAPI",
};

async function fillDraft(view) {
  const inputs = view.container.querySelectorAll("input.input-field");
  await view.type(inputs[0], DRAFT.company_name);
  await view.type(inputs[1], DRAFT.role_title);
  await view.type(inputs[2], DRAFT.tech_stack);
  await view.type(view.container.querySelector("textarea.textarea-field"), DRAFT.description);
  await view.click(view.buttons("Start Verification")[0]);
}

async function answerQuestions(view) {
  const boxes = view.container.querySelectorAll("textarea.question-textarea");
  await view.type(boxes[0], "It sits between ingest and the workers.");
  await view.type(boxes[1], "The team lead, with the on-call engineer having a veto.");
  await view.click(view.buttons("Submit Round for Defense")[0]);
}

describe("PostJobPage", () => {
  beforeEach(() => {
    jobsApi.generateCompanyQuiz.mockResolvedValue(QUIZ);
    jobsApi.submitCompanyQuiz.mockResolvedValue(FOLLOWUP);
  });

  test("the draft goes to the backend and the questions come back from it", async () => {
    const view = await render(<PostJobPage />);
    await fillDraft(view);

    expect(jobsApi.generateCompanyQuiz).toHaveBeenCalledWith({
      company_name: "Acme",
      role_title: "Backend Engineer",
      description: "Own the ingest pipeline.",
      tech_stack: ["Python", "FastAPI"],
    });
    expect(view.text()).toContain("Where does Kafka sit in that flow?");
    await view.unmount();
  });

  test("submitting answers opens the follow-up and grades nothing yet", async () => {
    const view = await render(<PostJobPage />);
    await fillDraft(view);
    await answerQuestions(view);

    expect(jobsApi.submitCompanyQuiz).toHaveBeenCalledTimes(1);
    // Grading before the defence would let a company bank a score and walk.
    expect(jobsApi.submitCompanyFollowUp).not.toHaveBeenCalled();
    expect(view.text()).toContain("You said the queue absorbs spikes");
    await view.unmount();
  });

  test("every question is sent, with its clock and paste signal", async () => {
    const view = await render(<PostJobPage />);
    await fillDraft(view);
    await answerQuestions(view);

    const [quizId, answers] = jobsApi.submitCompanyQuiz.mock.calls[0];
    expect(quizId).toBe("cq1");
    expect(answers).toHaveLength(2);
    expect(answers[0]).toMatchObject({ question_id: "q1", flagged_paste: false });
    expect(answers[0]).toHaveProperty("seconds_left");
    expect(answers[0]).toHaveProperty("paste_delta");
    await view.unmount();
  });

  test("a pass publishes and reports the posting", async () => {
    jobsApi.submitCompanyFollowUp.mockResolvedValue({
      quiz_id: "cq1", score: 98, pass_score: 70, passed: true, job_id: "j9",
      feedback: [{ question: "Where does Kafka sit?", score: 10, note: "Specific and consistent." }],
    });
    const onPublished = vi.fn();

    const view = await render(<PostJobPage onPublished={onPublished} />);
    await fillDraft(view);
    await answerQuestions(view);
    await view.type(view.container.querySelector("textarea.question-textarea"), "It backs up and ingest sheds load.");
    await view.click(view.buttons("Submit Follow-up")[0]);

    expect(jobsApi.submitCompanyFollowUp).toHaveBeenCalledTimes(1);
    expect(onPublished).toHaveBeenCalled();
    expect(view.text()).toContain("98");
    expect(view.text()).toContain("Published");
    await view.unmount();
  });

  test("the draft is not sent again at the end", async () => {
    jobsApi.submitCompanyFollowUp.mockResolvedValue({
      quiz_id: "cq1", score: 98, pass_score: 70, passed: true, job_id: "j9", feedback: [],
    });

    const view = await render(<PostJobPage />);
    await fillDraft(view);
    await answerQuestions(view);
    await view.type(view.container.querySelector("textarea.question-textarea"), "It backs up.");
    await view.click(view.buttons("Submit Follow-up")[0]);

    // The backend publishes the draft it has held since generation. Re-sending it
    // here would be the seam that lets an honest draft be defended and a rosier
    // one published.
    const [quizId, answer, secondsLeft] = jobsApi.submitCompanyFollowUp.mock.calls[0];
    expect(quizId).toBe("cq1");
    expect(answer).toBe("It backs up.");
    expect(secondsLeft).toEqual(expect.any(Number));
    expect(jobsApi.submitCompanyFollowUp.mock.calls[0]).toHaveLength(3);
    await view.unmount();
  });

  test("a failing round publishes nothing and says what to fix", async () => {
    jobsApi.submitCompanyFollowUp.mockResolvedValue({
      quiz_id: "cq1", score: 52, pass_score: 70, passed: false, job_id: null,
      feedback: [{ question: "Who decides?", score: 3, note: "Restated the posting." }],
    });
    const onPublished = vi.fn();

    const view = await render(<PostJobPage onPublished={onPublished} />);
    await fillDraft(view);
    await answerQuestions(view);
    await view.type(view.container.querySelector("textarea.question-textarea"), "Not sure.");
    await view.click(view.buttons("Submit Follow-up")[0]);

    expect(onPublished).not.toHaveBeenCalled();
    expect(view.text()).toContain("Not published");
    expect(view.text()).toContain("Restated the posting.");
    // The point of the gate is to send them back to rewrite it.
    expect(view.buttons("Edit the posting").length).toBeGreaterThan(0);
    await view.unmount();
  });

  test("a rejected generate surfaces the error instead of a half-started round", async () => {
    jobsApi.generateCompanyQuiz.mockRejectedValue(new Error("add more detail about the role"));

    const view = await render(<PostJobPage />);
    await fillDraft(view);

    expect(view.text()).toContain("add more detail about the role");
    await view.unmount();
  });
});
