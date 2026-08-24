import { useState } from "react";
import CreatePostCard from "./components/CreatePostCard";
import PostCard from "./components/PostCard";
import SuggestedPeers from "./components/SuggestedPeers";
import Avatar from "../../shared/components/Avatar";
import {
  SparklesIcon,
  ShieldLockIcon,
  CheckCircleIcon,
  QuizIcon,
  ReputationIcon,
} from "../../shared/components/Icons";

const INITIAL_POSTS = [
  {
    id: "post_1",
    authorName: "Sarah Chen",
    authorHandle: "@schen_dev",
    authorRole: "candidate",
    revealed: true,
    timestamp: "2h ago",
    content:
      "Just passed the live repo quiz on my Raft consensus implementation in Go. The adaptive defense question specifically pressed on my split-brain election state machine in consensus.go. Super refreshing to be evaluated on reasoning rather than LeetCode trivia.",
    tag: "#RepoQuizPass",
    milestone: {
      title: "Raft Consensus Engine (Go)",
      score: 95,
      complexity: "Complex (Tier 3)",
    },
    likesCount: 24,
    isLiked: false,
    comments: [
      {
        author: "Devon Miller",
        text: "Congrats! How did you defend the heartbeat timer jitter in the follow-up?",
      },
    ],
  },
  {
    id: "post_2",
    authorName: "Anonymous Candidate",
    authorHandle: "@ac_910",
    authorRole: "candidate",
    revealed: false,
    timestamp: "5h ago",
    content:
      "Gave the repo quiz a shot on my FastAPI microservice backend. The 75-second wall clock keeps you focused on first principles. Identity unlocks at 70+; getting ready for round 2 on my distributed cache repo.",
    tag: "#Engineering",
    likesCount: 12,
    isLiked: false,
    comments: [],
  },
  {
    id: "post_3",
    authorName: "Apex Cloud Infrastructure",
    authorHandle: "@apex_engineering",
    authorRole: "employer",
    revealed: true,
    timestamp: "1d ago",
    content:
      "We just completed our company-side technical gating audit and posted 2 new backend roles for distributed systems engineers. We review verified repo comprehension profiles before any screening calls.",
    tag: "#Hiring",
    likesCount: 38,
    isLiked: false,
    comments: [],
  },
];

export default function FeedPage({ userProfile, onNavigateQuiz, onNavigateReputation }) {
  const [posts, setPosts] = useState(INITIAL_POSTS);

  const name = userProfile?.revealed ? userProfile?.name || "Candidate" : "Anonymous Candidate";
  const revealed = Boolean(userProfile?.revealed);
  const role = userProfile?.role || "candidate";

  function handlePublishPost({ content, tag }) {
    const newPost = {
      id: "post_" + Date.now(),
      authorName: name,
      authorHandle: "@" + (revealed ? name.toLowerCase().replace(/\s+/g, "_") : "anonymous"),
      authorRole: role,
      revealed: revealed,
      timestamp: "Just now",
      content: content,
      tag: tag,
      likesCount: 0,
      isLiked: false,
      comments: [],
    };
    setPosts([newPost, ...posts]);
  }

  function handleLike(postId) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.isLiked;
        return {
          ...p,
          isLiked: nextLiked,
          likesCount: p.likesCount + (nextLiked ? 1 : -1),
        };
      })
    );
  }

  function handleAddComment(postId, text) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: [...(p.comments || []), { author: name, text }],
        };
      })
    );
  }

  return (
    <div className="feed-container">
      {/* Create Post Card */}
      <CreatePostCard userProfile={userProfile} onPublishPost={handlePublishPost} />

      {/* Feed Stream */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onAddComment={handleAddComment}
            currentUserName={name}
          />
        ))}
      </div>
    </div>
  );
}
