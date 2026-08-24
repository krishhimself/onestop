import React from "react";
import { CheckCircleIcon, ShieldLockIcon } from "./Icons";

// Deterministic professional color tones based on string seed
function getAvatarBg(seed = "") {
  const tones = [
    "#2B6CB0", // Soft Echo Blue (deep)
    "#243B53", // Deep Navy
    "#334E6B", // Slate Navy
    "#475569", // Slate Grey
    "#0E7490", // Ocean Slate
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
  }
  return tones[Math.abs(hash) % tones.length];
}

function getInitials(name) {
  if (!name || name === "Anonymous Candidate") return "AC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name = "Anonymous Candidate",
  size = "md",
  revealed = false,
  role = "candidate",
  showBadge = false,
  className = "",
}) {
  const initials = getInitials(name);
  const sizeClass = `avatar-${size}`;
  const isAnonymous = !revealed || name === "Anonymous Candidate";
  const bg = isAnonymous ? "#475569" : getAvatarBg(name);

  return (
    <div className={`avatar-wrap ${className}`}>
      <div
        className={`avatar-initials ${sizeClass} ${revealed ? "avatar-ring-revealed" : ""}`}
        style={{
          backgroundColor: bg,
          color: "#FFFFFF",
        }}
        title={`${name} (${role})`}
      >
        {initials}
      </div>

      {showBadge && (
        <div className="avatar-badge-icon">
          {revealed ? (
            <CheckCircleIcon size={12} className="avatar-badge-svg" style={{ color: "var(--success)" }} />
          ) : (
            <ShieldLockIcon size={12} className="avatar-badge-svg" style={{ color: "var(--text-subtle)" }} />
          )}
        </div>
      )}
    </div>
  );
}
