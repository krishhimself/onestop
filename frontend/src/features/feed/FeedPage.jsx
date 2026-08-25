import { useCallback, useEffect, useState } from "react";
import CreatePostCard from "./components/CreatePostCard";
import PostCard from "./components/PostCard";
import { fetchPosts, createPost } from "../community/api";

/**
 * The community feed.
 *
 * Text only, newest first, and that is the whole surface — there are no likes,
 * reactions, or replies here because there are none in the API either. Each of
 * those is a schema change on purpose (see the README), so a control for one
 * would have nothing behind it.
 *
 * The author is never sent: the backend takes it from the access token, so a post
 * cannot be attributed to somebody else. An unrevealed author comes back as
 * "Anonymous Candidate" with no name in the payload at all.
 */
const PAGE_SIZE = 20;

export default function FeedPage({ userProfile, onUnauthorized, onOpenProfile }) {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPosts(PAGE_SIZE, 0);
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Failed to load the feed.");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePublishPost({ content }) {
    setPublishing(true);
    setError("");
    try {
      // The response is rendered from the document that was stored, so what
      // appears here is what the next reader will see.
      const created = await createPost({ text: content });
      setPosts((prev) => [created, ...prev]);
      setTotal((n) => n + 1);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message || "Failed to publish that post.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="feed-container">
      <CreatePostCard
        userProfile={userProfile}
        onPublishPost={handlePublishPost}
        publishing={publishing}
      />

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading the feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>
            Nothing posted yet
          </h3>
          <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto", fontSize: "13px" }}>
            Say something about what you are building. Posts are text, and you stay a
            pseudonym here for exactly as long as you are one on your profile.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {posts.map((post) => (
            <PostCard key={post.post_id} post={post} onOpenProfile={onOpenProfile} />
          ))}

          {total > posts.length && (
            <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-subtle)" }}>
              Showing {posts.length} of {total}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
