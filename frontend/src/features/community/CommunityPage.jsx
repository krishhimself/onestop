import { useEffect, useState } from "react";
import { createPost, fetchPosts } from "./api";

/**
 * The community feed: text posts, newest first, with a box to add one.
 *
 * Deliberately the whole feature. No comments, likes, reactions, threaded
 * replies or media — those are roadmap, and each of them is a schema change
 * rather than a flag, which is what keeps this from drifting into a social
 * network by accident.
 *
 * Authors render as whatever the backend says: an unrevealed candidate is
 * "Anonymous Candidate" here for exactly as long as they are one on their
 * profile, and the real name is never in the payload to begin with.
 */
const PAGE = 20;

export default function CommunityPage({ onUnauthorized }) {
  const [feed, setFeed] = useState(null);
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(skip = 0) {
    setLoading(true);
    try {
      setFeed(await fetchPosts(PAGE, skip));
      setError("");
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
  }, []);

  async function handlePost() {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError("");
    try {
      await createPost({ text: text.trim(), jobId, companyName });
      setText("");
      setJobId("");
      setCompanyName("");
      // Re-read rather than splicing the new post in: the feed is the source of
      // truth for ordering, and it is one cheap call.
      await load(0);
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setError(e.message);
    } finally {
      setPosting(false);
    }
  }

  const posts = feed?.posts ?? [];
  const skip = feed?.skip ?? 0;
  const total = feed?.total ?? 0;

  return (
    <div className="container">
      <h1>Community</h1>
      <p className="tagline">What people are working on, hiring for, and running into.</p>

      <div className="draft">
        <label>
          Say something
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="What are you working on?"
          />
        </label>
        <div className="row">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company (optional)"
          />
          <input
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Job id (optional)"
          />
          <button onClick={handlePost} disabled={posting || !text.trim()}>
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && !feed ? (
        <p className="rules">Loading feed...</p>
      ) : posts.length === 0 ? (
        <p className="rules">Nothing here yet. Yours would be the first.</p>
      ) : (
        posts.map((post) => (
          <div key={post.post_id} className="feedback-item">
            <p className="q">
              {post.author?.name}
              {post.company_name && <span className="ref"> · {post.company_name}</span>}
            </p>
            <p className="s post-text">{post.text}</p>
            {post.job_id && <p className="stat-hint">Job reference: {post.job_id}</p>}
          </div>
        ))
      )}

      {total > PAGE && (
        <div className="row">
          <button onClick={() => load(Math.max(0, skip - PAGE))} disabled={skip === 0}>
            Newer
          </button>
          <button onClick={() => load(skip + PAGE)} disabled={skip + PAGE >= total}>
            Older
          </button>
        </div>
      )}
    </div>
  );
}
