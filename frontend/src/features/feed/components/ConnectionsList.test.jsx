import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "../../../test/render.jsx";
import ConnectionsList from "./ConnectionsList.jsx";
import * as communityApi from "../../community/api.js";
import * as token from "../../../shared/api/token.js";

vi.mock("../../community/api.js");
vi.mock("../../../shared/api/token.js");

/**
 * This sidebar shipped as "Suggested Peers": three invented engineers behind a
 * connect button that toggled local state. It read as a working feature and was
 * a constant array.
 *
 * There is no discovery endpoint to suggest anyone from, so the honest surface is
 * the one that exists — who you are actually connected to.
 */
describe("ConnectionsList", () => {
  beforeEach(() => {
    token.getUserId.mockReturnValue("u1");
    communityApi.fetchConnections.mockResolvedValue({
      user_id: "u1",
      count: 2,
      connections: [
        { user_id: "u2", name: "Grace Hopper", revealed: true, connected_at: null },
        { user_id: "u3", name: "Anonymous Candidate", revealed: false, connected_at: null },
      ],
    });
  });

  test("reads connections from the API on mount", async () => {
    const view = await render(<ConnectionsList />);

    expect(communityApi.fetchConnections).toHaveBeenCalledWith("u1");
    await view.unmount();
  });

  test("lists the people the API returned", async () => {
    const view = await render(<ConnectionsList />);

    expect(view.text()).toContain("Grace Hopper");
    expect(view.text()).toContain("Anonymous Candidate");
    await view.unmount();
  });

  test("having none says so rather than suggesting invented people", async () => {
    communityApi.fetchConnections.mockResolvedValue({ user_id: "u1", count: 0, connections: [] });

    const view = await render(<ConnectionsList />);

    expect(view.text()).toContain("No connections yet");
    await view.unmount();
  });

  test("an unrevealed connection stays a pseudonym", async () => {
    const view = await render(<ConnectionsList />);

    // The name is not in the payload at all for an unrevealed account, so there is
    // nothing here to leak — this asserts the list does not invent one back.
    expect(view.text()).not.toContain("u3");
    expect(view.text()).toContain("Anonymous");
    await view.unmount();
  });

  test("re-reads when a connection is made elsewhere", async () => {
    const view = await render(<ConnectionsList refreshKey={0} />);
    expect(communityApi.fetchConnections).toHaveBeenCalledTimes(1);
    await view.unmount();

    const again = await render(<ConnectionsList refreshKey={1} />);
    expect(communityApi.fetchConnections).toHaveBeenCalledTimes(2);
    await again.unmount();
  });

  test("opening a connection's profile passes their id up", async () => {
    const onOpenProfile = vi.fn();

    const view = await render(<ConnectionsList onOpenProfile={onOpenProfile} />);
    await view.click(view.buttons("View")[0]);

    expect(onOpenProfile).toHaveBeenCalledWith("u2");
    await view.unmount();
  });

  test("a failed read says so instead of rendering a stale list", async () => {
    communityApi.fetchConnections.mockRejectedValue(new Error("upstream is down"));

    const view = await render(<ConnectionsList />);

    expect(view.text()).toContain("upstream is down");
    await view.unmount();
  });
});
