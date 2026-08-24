import { useState } from "react";
import Avatar from "../../../shared/components/Avatar";
import { SendIcon } from "../../../shared/components/Icons";

const AVAILABLE_TAGS = [
  "#RepoQuizPass",
  "#Architecture",
  "#Engineering",
  "#Hiring",
  "#OpenSource",
];

export default function CreatePostCard({ userProfile, onPublishPost }) {
  const [content, setContent] = useState("");
  const [selectedTag, setSelectedTag] = useState("#RepoQuizPass");
  const name = userProfile?.revealed ? userProfile?.name || "Candidate" : "Anonymous Candidate";
  const revealed = Boolean(userProfile?.revealed);
  const role = userProfile?.role || "candidate";

  function handlePublish() {
    if (!content.trim()) return;
    onPublishPost({
      content: content.trim(),
      tag: selectedTag,
    });
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
        <div className="post-tag-selector">
          {AVAILABLE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={`post-tag-btn ${selectedTag === t ? "active" : ""}`}
              onClick={() => setSelectedTag(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={handlePublish}
          disabled={!content.trim()}
        >
          <span>Publish Post</span>
          <SendIcon size={12} />
        </button>
      </div>
    </div>
  );
}
