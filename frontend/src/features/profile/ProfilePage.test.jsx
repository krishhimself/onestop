import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, profileFixture } from "../../test/render.jsx";
import ProfilePage from "./ProfilePage.jsx";
import * as profileApi from "./api.js";
import * as reputationApi from "../reputation/api.js";
import * as communityApi from "../community/api.js";
import * as token from "../../shared/api/token.js";

vi.mock("./api.js");
vi.mock("../reputation/api.js");
vi.mock("../community/api.js");
vi.mock("../../shared/api/token.js");

/**
 * This page once rendered four "pillar" cards that read Verified or Pending off
 * the revealed flag and called no reputation endpoint at all. It looked like a
 * score and was a boolean in four costumes.
 *
 * So the assertions are: the endpoint is called, the numbers on screen are the
 * ones it returned, and the overall figure never appears without the quiz count
 * that qualifies it.
 */
const REPUTATION = {
  user_id: "u1",
  overall: 71,
  comprehension: 88,
  quiz_count: 3,
  rounds_reached: 2,
};

describe("ProfilePage", () => {
  beforeEach(() => {
    token.getUserId.mockReturnValue("u1");
    profileApi.getProfile.mockResolvedValue(profileFixture({ revealed: true, name: "Ada Lovelace", email: "ada@x.com" }));
    reputationApi.getReputation.mockResolvedValue(REPUTATION);
  });

  test("reads the profile and the reputation from the API", async () => {
    const view = await render(<ProfilePage />);

    expect(profileApi.getProfile).toHaveBeenCalledWith("u1");
    expect(reputationApi.getReputation).toHaveBeenCalledWith("u1");
    await view.unmount();
  });

  test("shows the reputation the API returned", async () => {
    const view = await render(<ProfilePage />);
    const text = view.text();

    expect(text).toContain("71");
    expect(text).toContain("88");
    expect(text).toContain("3");
    expect(text).toContain("2");
    await view.unmount();
  });

  test("the overall figure never appears without the quiz count beside it", async () => {
    // A 92 across one quiz and a 92 across six are different claims. The count is
    // what says which one this is, so it renders in the same pass or not at all.
    const view = await render(<ProfilePage />);
    const text = view.text();

    expect(text).toContain("Overall");
    expect(text).toContain("Quizzes defended");
    await view.unmount();
  });

  test("a new account reads as new rather than as failing", async () => {
    reputationApi.getReputation.mockResolvedValue({
      user_id: "u1", overall: 0, comprehension: 0, quiz_count: 0, rounds_reached: 0,
    });

    const view = await render(<ProfilePage />);

    expect(view.text()).toContain("Nothing here yet");
    await view.unmount();
  });

  test("an unrevealed profile renders the pseudonym and no email", async () => {
    profileApi.getProfile.mockResolvedValue(profileFixture({ revealed: false }));

    const view = await render(<ProfilePage />);

    expect(view.text()).toContain("Anonymous Candidate");
    expect(view.text()).not.toContain("@");
    await view.unmount();
  });

  test("viewing someone else offers connect, and it goes through the API", async () => {
    communityApi.connectTo.mockResolvedValue({
      connection_id: "c1", user_id: "u1", connected_to: "u2", created: true,
    });
    profileApi.getProfile.mockResolvedValue(
      profileFixture({ user_id: "u2", revealed: true, name: "Grace Hopper" })
    );
    const onConnected = vi.fn();

    const view = await render(<ProfilePage userId="u2" onConnected={onConnected} />);
    await view.click(view.buttons("Connect")[0]);

    expect(communityApi.connectTo).toHaveBeenCalledWith("u2");
    expect(onConnected).toHaveBeenCalled();
    await view.unmount();
  });

  test("connecting again is a no-op rather than a second connection", async () => {
    communityApi.connectTo.mockResolvedValue({
      connection_id: "c1", user_id: "u1", connected_to: "u2", created: false,
    });
    profileApi.getProfile.mockResolvedValue(profileFixture({ user_id: "u2", revealed: true, name: "Grace Hopper" }));
    const onConnected = vi.fn();

    const view = await render(<ProfilePage userId="u2" onConnected={onConnected} />);
    await view.click(view.buttons("Connect")[0]);

    expect(view.text()).toContain("Already Connected");
    // Nothing was created, so nothing needs re-reading.
    expect(onConnected).not.toHaveBeenCalled();
    await view.unmount();
  });

  test("your own profile offers no connect button", async () => {
    const view = await render(<ProfilePage />);

    expect(view.buttons("Connect")).toHaveLength(0);
    await view.unmount();
  });

  test("401 logs out rather than rendering a blank profile", async () => {
    profileApi.getProfile.mockRejectedValue(Object.assign(new Error("expired"), { status: 401 }));
    const onUnauthorized = vi.fn();

    const view = await render(<ProfilePage onUnauthorized={onUnauthorized} />);

    expect(onUnauthorized).toHaveBeenCalled();
    await view.unmount();
  });
});
