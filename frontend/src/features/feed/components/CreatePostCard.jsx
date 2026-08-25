import { useState } from "react";
import Avatar from "../../../shared/components/Avatar";
import { SendIcon } from "../../../shared/components/Icons";

// Mirrors MAX_POST_LENGTH in community_service.py. The backend rejects anything
// longer; this only saves the round trip.
const MAX_POST_LENGTH = 2000;

export default function CreatePostCard({ userProfile, onPublishPost, publishing }) {
  const [content, setContent] = useState("");
  const name = userProfile?.revealed ? userProfile?.name || "Candidate" : "Anonymous Candidate";
  const revealed = Boolean(userProfile?.revealed);
  const role = userProfile?.role || "candidate";

  const body = content.trim();
  const tooLong = body.length > MAX_POST_LENGTH;
  const ready = body.length > 0 && !tooLong && !publishing;

  async function handlePublish() {
    if (!ready) return;
    await onPublishPost({ content: body });
    setContent("");
  }

  return (
    <div className="create-post-card">
      <div className="create-post-top">
        <Avatar name={name} size="md" revealed={revealed} role={role} showBadge />
        <div style={{ flex: 1 }}>
          <textarea
            className="create-post-input"
            placeholder="Share an architectural insight, repo quiz takeaway, or engineering update..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>

      <div className="create-post-actions">
        <span style={{ fontSize: "12px", color: tooLong ? "var(--accent)" : "var(--text-subtle)" }}>
          {body.length} / {MAX_POST_LENGTH}
          {!revealed && " · posting as Anonymous Candidate"}
        </span>

        <button className="btn btn-primary btn-sm" onClick={handlePublish} disabled={!ready}>
          <span>{publishing ? "Publishing..." : "Publish Post"}</span>
          <SendIcon size={12} />
        </button>
      </div>
    </div>
  );
}
