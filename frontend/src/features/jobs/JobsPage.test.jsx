import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "../../test/render.jsx";
import JobsPage from "./JobsPage.jsx";
import * as jobsApi from "./api.js";
import * as token from "../../shared/api/token.js";

vi.mock("./api.js");
vi.mock("../../shared/api/token.js");

/**
 * The gate is the product. A posting exists only as the output of a defended
 * company quiz, and this page once shipped a version that asked two hardcoded
 * questions, accepted any answer over ten characters, and then called a
 * createJob() that posted to a route the backend does not define.
 *
 * Both halves of that failure are asserted here: that no ungated create path
 * exists to call, and that choosing to post actually starts the real round.
 */
const JOB = {
  id: "j1",
  role_title: "Backend Engineer",
  company_name: "Acme",
  description: "Own the ingest pipeline.",
  tech_stack: ["Python", "FastAPI"],
};

function asEmployer() {
  token.getUserId.mockReturnValue("emp1");
  token.getUserRole.mockReturnValue("employer");
  token.getRole.mockReturnValue("employer");
}

function asCandidate() {
  token.getUserId.mockReturnValue("cand1");
  token.getUserRole.mockReturnValue("candidate");
  token.getRole.mockReturnValue("candidate");
}

describe("JobsPage", () => {
  beforeEach(() => {
    jobsApi.fetchJobs.mockResolvedValue([JOB]);
    asCandidate();
  });

  test("lists jobs from the API on mount", async () => {
    const view = await render(<JobsPage userProfile={{ role: "candidate" }} />);

    expect(jobsApi.fetchJobs).toHaveBeenCalledTimes(1);
    expect(view.text()).toContain("Backend Engineer");
    expect(view.text()).toContain("Acme");
    await view.unmount();
  });

  test("an empty list says so instead of showing sample roles", async () => {
    jobsApi.fetchJobs.mockResolvedValue([]);

    const view = await render(<JobsPage userProfile={{ role: "candidate" }} />);

    expect(view.text()).toContain("No Active Job Postings");
    expect(view.text()).not.toContain("Backend Engineer");
    await view.unmount();
  });

  test("applying goes through the API", async () => {
    jobsApi.applyToJob.mockResolvedValue({ id: "a1" });

    const view = await render(<JobsPage userProfile={{ role: "candidate" }} />);
    await view.click(view.buttons("Apply")[0]);

    expect(jobsApi.applyToJob).toHaveBeenCalledWith("j1", "cand1");
    await view.unmount();
  });

  // --- the gate ------------------------------------------------------------

  test("the jobs API exposes no way to create a posting directly", () => {
    // The backend has no ungated POST /jobs/. A create helper here would either
    // be dead or be a second way in; both mean the gate has stopped being one.
    expect(jobsApi.createJob).toBeUndefined();
  });

  test("choosing to post starts the real company quiz, not a local form", async () => {
    asEmployer();
    jobsApi.generateCompanyQuiz.mockResolvedValue({
      quiz_id: "cq1",
      role_title: "Backend Engineer",
      questions: [{ id: "q1", question: "Where does Kafka sit?", category: "stack" }],
      time_limit_seconds: 75,
    });

    const view = await render(<JobsPage userProfile={{ role: "employer" }} />);
    await view.click(view.buttons("Post a Role")[0]);

    // The draft form is the first step, and it is the backend that turns it into
    // questions — nothing here invents them.
    expect(view.text()).toContain("Draft the role");

    const inputs = view.container.querySelectorAll("input.input-field");
    await view.type(inputs[0], "Acme");
    await view.type(inputs[1], "Backend Engineer");
    await view.type(view.container.querySelector("textarea.textarea-field"), "Own the ingest pipeline.");
    await view.click(view.buttons("Start Verification")[0]);

    expect(jobsApi.generateCompanyQuiz).toHaveBeenCalledTimes(1);
    expect(jobsApi.generateCompanyQuiz).toHaveBeenCalledWith({
      company_name: "Acme",
      role_title: "Backend Engineer",
      description: "Own the ingest pipeline.",
      tech_stack: [],
    });
    // The questions rendered are the ones the backend generated.
    expect(view.text()).toContain("Where does Kafka sit?");
    await view.unmount();
  });

  test("a candidate is not offered the posting flow at all", async () => {
    asCandidate();

    const view = await render(<JobsPage userProfile={{ role: "candidate" }} />);

    // The company-quiz routes require an employer token; an entry point here
    // would only lead to a 403.
    expect(view.buttons("Post a Role")).toHaveLength(0);
    await view.unmount();
  });

  test("401 on load logs out rather than showing an empty board", async () => {
    jobsApi.fetchJobs.mockRejectedValue(Object.assign(new Error("expired"), { status: 401 }));
    const onUnauthorized = vi.fn();

    const view = await render(
      <JobsPage userProfile={{ role: "candidate" }} onUnauthorized={onUnauthorized} />
    );

    expect(onUnauthorized).toHaveBeenCalled();
    await view.unmount();
  });
});
