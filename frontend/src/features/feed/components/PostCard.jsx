import Avatar from "../../../shared/components/Avatar";
import { CheckCircleIcon } from "../../../shared/components/Icons";

/**
 * One post, exactly as the API returns it.
 *
 * There are no like, reply, or share controls because none of them exist behind
 * the feed — see "what is deliberately absent" in the README. A control here for
 * something the backend does not store would be a claim the platform cannot keep.
 */
function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function PostCard({ post, onOpenProfile }) {
  // `author.name` already carries the pseudonym when the author is unrevealed;
  // the real name is not in the payload at all, so there is nothing to hide here.
  const author = post.author || {};
  const revealed = Boolean(author.revealed);

  return (
    <article className="post-card">
      <div className="post-author-row">
        <div className="post-author-info">
          <Avatar
            name={author.name}
            size="md"
            revealed={revealed}
            role="candidate"
            showBadge
          />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="post-author-name">
              {onOpenProfile && author.user_id ? (
                <button
                  type="button"
                  className="btn-linklike"
                  onClick={() => onOpenProfile(author.user_id)}
                >
                  {author.name}
                </button>
              ) : (
                <span>{author.name}</span>
              )}
              {revealed && (
                <CheckCircleIcon size={13} style={{ color: "var(--success)" }} />
              )}
            </div>

            <span className="post-timestamp">{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {revealed ? (
          <span className="badge badge-success">Revealed</span>
        ) : (
          <span className="badge badge-cream">Anonymous</span>
        )}
      </div>

      <p className="post-content">{post.text}</p>

      {(post.company_name || post.job_id) && (
        <div className="post-milestone-box">
          <div>
            <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>
              {post.company_name || "Referenced posting"}
            </strong>
            {post.job_id && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Job {post.job_id}
              </div>
            )}
          </div>
          <span className="badge badge-mist">Posting</span>
        </div>
      )}
    </article>
  );
}
