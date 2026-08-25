import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "../../test/render.jsx";
import FeedPage from "./FeedPage.jsx";
import * as communityApi from "../community/api.js";

vi.mock("../community/api.js");

/**
 * The guard these tests exist for.
 *
 * A rebuild of this page once shipped three hardcoded posts by invented people
 * and never called the API at all. Nothing caught it: the build was green, the
 * backend suite was green, and a hardcoded array is not a type error. The only
 * thing that distinguishes that page from this one is whether mounting it makes
 * the request — so that is what is asserted first, before anything about how it
 * looks.
 */
const POST = {
  post_id: "p1",
  author: { user_id: "u9", name: "Ada Lovelace", revealed: true },
  text: "Shipped the scheduler rewrite.",
  job_id: null,
  company_name: null,
  created_at: new Date().toISOString(),
};

describe("FeedPage", () => {
  beforeEach(() => {
    communityApi.fetchPosts.mockResolvedValue({
      total: 1,
      limit: 20,
      skip: 0,
      posts: [POST],
    });
  });

  test("reads the feed from the API on mount", async () => {
    const view = await render(<FeedPage userProfile={null} />);

    expect(communityApi.fetchPosts).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  test("renders the posts the API returned, not its own", async () => {
    const view = await render(<FeedPage userProfile={null} />);

    expect(view.text()).toContain("Shipped the scheduler rewrite.");
    expect(view.text()).toContain("Ada Lovelace");
    await view.unmount();
  });

  test("an empty feed says so instead of inventing posts", async () => {
    communityApi.fetchPosts.mockResolvedValue({ total: 0, limit: 20, skip: 0, posts: [] });

    const view = await render(<FeedPage userProfile={null} />);

    expect(view.text()).toContain("Nothing posted yet");
    await view.unmount();
  });

  test("publishing sends the text to the API and shows what came back", async () => {
    communityApi.createPost.mockResolvedValue({
      ...POST,
      post_id: "p2",
      text: "My first post.",
    });

    const view = await render(<FeedPage userProfile={{ revealed: false }} />);
    const box = view.container.querySelector("textarea");
    await view.type(box, "My first post.");
    await view.click(view.buttons("Publish Post")[0]);

    expect(communityApi.createPost).toHaveBeenCalledWith({ text: "My first post." });
    expect(view.text()).toContain("My first post.");
    await view.unmount();
  });

  test("the author is never sent — the backend takes it from the token", async () => {
    communityApi.createPost.mockResolvedValue({ ...POST, post_id: "p3", text: "hello" });

    const view = await render(<FeedPage userProfile={{ revealed: true, name: "Ada" }} />);
    await view.type(view.container.querySelector("textarea"), "hello");
    await view.click(view.buttons("Publish Post")[0]);

    const [body] = communityApi.createPost.mock.calls[0];
    // A post attributed from the body would let anyone post as anyone.
    expect(Object.keys(body)).toEqual(["text"]);
    await view.unmount();
  });

  test("an unrevealed author stays a pseudonym in the feed", async () => {
    communityApi.fetchPosts.mockResolvedValue({
      total: 1,
      limit: 20,
      skip: 0,
      posts: [
        {
          ...POST,
          author: { user_id: "u2", name: "Anonymous Candidate", revealed: false },
        },
      ],
    });

    const view = await render(<FeedPage userProfile={null} />);

    expect(view.text()).toContain("Anonymous Candidate");
    await view.unmount();
  });

  test("a failed read surfaces the error rather than falling back to samples", async () => {
    communityApi.fetchPosts.mockRejectedValue(new Error("upstream is down"));

    const view = await render(<FeedPage userProfile={null} />);

    expect(view.text()).toContain("upstream is down");
    await view.unmount();
  });

  test("401 logs out instead of rendering a signed-out feed", async () => {
    const unauthorized = Object.assign(new Error("expired"), { status: 401 });
    communityApi.fetchPosts.mockRejectedValue(unauthorized);
    const onUnauthorized = vi.fn();

    const view = await render(
      <FeedPage userProfile={null} onUnauthorized={onUnauthorized} />
    );

    expect(onUnauthorized).toHaveBeenCalled();
    await view.unmount();
  });

  test("no control is offered for anything the API cannot store", async () => {
    const view = await render(<FeedPage userProfile={null} />);

    // Likes, replies and shares are deliberately absent from the backend. A
    // button for one here would be a claim the platform cannot keep.
    const labels = [...view.container.querySelectorAll("button")]
      .map((b) => (b.textContent || "").toLowerCase())
      .join(" ");
    expect(labels).not.toMatch(/like|repl(y|ies)|comment|share/);
    await view.unmount();
  });
});
