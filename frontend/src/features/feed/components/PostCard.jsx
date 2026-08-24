import { useState } from "react";
import Avatar from "../../../shared/components/Avatar";
import {
  HeartIcon,
  MessageIcon,
  ShareIcon,
  CheckCircleIcon,
  SendIcon,
} from "../../../shared/components/Icons";

export default function PostCard({ post, onLike, onAddComment, currentUserName }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sharedNotice, setSharedNotice] = useState(false);

  function handleCommentSubmit(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(post.id, commentText.trim());
    setCommentText("");
  }

  function handleShare() {
    setSharedNotice(true);
    setTimeout(() => setSharedNotice(false), 2000);
  }

  return (
    <article className="post-card">
      {/* Author Row */}
      <div className="post-author-row">
        <div className="post-author-info">
          <Avatar
            name={post.authorName}
            size="md"
            revealed={post.revealed}
            role={post.authorRole}
            showBadge
          />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="post-author-name">
              <span>{post.authorName}</span>
              {post.revealed && (
                <CheckCircleIcon size={13} style={{ color: "var(--success)" }} />
              )}
              {post.tag && (
                <span className="badge badge-accent" style={{ fontSize: "10px", padding: "1px 5px" }}>
                  {post.tag}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span className="post-author-handle">{post.authorHandle || "@engineer"}</span>
              <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>·</span>
              <span className="post-timestamp">{post.timestamp}</span>
            </div>
          </div>
        </div>

        {post.authorRole === "employer" ? (
          <span className="badge badge-cream">Employer</span>
        ) : (
          <span className="badge badge-mist">Candidate</span>
        )}
      </div>

      {/* Post Text */}
      <p className="post-content">{post.content}</p>

      {/* Milestone Box */}
      {post.milestone && (
        <div className="post-milestone-box">
          <div>
            <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>
              {post.milestone.title}
            </strong>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Score: {post.milestone.score}/100 · Complexity: {post.milestone.complexity}
            </div>
          </div>

          <span className="badge badge-success">Verified Defense</span>
        </div>
      )}

      {/* Footer Actions Bar */}
      <div className="post-footer-actions">
        <button
          type="button"
          className={`post-action-btn ${post.isLiked ? "liked" : ""}`}
          onClick={() => onLike(post.id)}
        >
          <HeartIcon size={14} fill={post.isLiked} />
          <span>{post.likesCount || 0}</span>
        </button>

        <button
          type="button"
          className="post-action-btn"
          onClick={() => setShowComments((prev) => !prev)}
        >
          <MessageIcon size={14} />
          <span>{(post.comments || []).length} Replies</span>
        </button>

        <button
          type="button"
          className="post-action-btn"
          onClick={handleShare}
          title="Share post"
        >
          <ShareIcon size={14} />
          <span>{sharedNotice ? "Copied" : "Share"}</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <div className="comments-section">
          {(post.comments || []).map((c, i) => (
            <div key={i} className="comment-row">
              <Avatar name={c.author} size="sm" />
              <div className="comment-bubble">
                <div className="comment-author">{c.author}</div>
                <div style={{ color: "var(--text-muted)" }}>{c.text}</div>
              </div>
            </div>
          ))}

          {/* New Comment Input */}
          <form onSubmit={handleCommentSubmit} className="comment-input-row">
            <input
              type="text"
              className="input-field"
              style={{ padding: "6px 10px", fontSize: "12px" }}
              placeholder="Write a technical reply..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={!commentText.trim()}
            >
              <SendIcon size={12} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
