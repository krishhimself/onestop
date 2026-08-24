import { useState } from "react";
import Avatar from "../../../shared/components/Avatar";
import { UserIcon } from "../../../shared/components/Icons";

const INITIAL_PEERS = [
  {
    id: "peer_1",
    name: "Elena Rostova",
    handle: "@erostova",
    role: "Distributed Systems Eng",
    revealed: true,
  },
  {
    id: "peer_2",
    name: "Anonymous Candidate",
    handle: "@ac_488",
    role: "Fullstack Builder",
    revealed: false,
  },
  {
    id: "peer_3",
    name: "Marcus Vance",
    handle: "@mvance_dev",
    role: "ML Platform Eng",
    revealed: true,
  },
];

export default function SuggestedPeers() {
  const [connections, setConnections] = useState({});

  function handleToggleConnect(peerId) {
    setConnections((prev) => ({
      ...prev,
      [peerId]: !prev[peerId],
    }));
  }

  return (
    <aside className="sidebar-widget">
      <div className="sidebar-widget-title">
        <UserIcon size={13} style={{ color: "var(--text-subtle)" }} />
        <span>Verified Engineers</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {INITIAL_PEERS.map((peer) => {
          const isConnected = Boolean(connections[peer.id]);

          return (
            <div key={peer.id} className="peer-row">
              <div className="peer-info">
                <Avatar
                  name={peer.name}
                  size="sm"
                  revealed={peer.revealed}
                  role="candidate"
                  showBadge
                />
                <div className="peer-text">
                  <span className="peer-name">{peer.name}</span>
                  <span className="peer-role">{peer.role}</span>
                </div>
              </div>

              <button
                type="button"
                className={`btn ${isConnected ? "btn-secondary" : "btn-primary"} btn-sm`}
                onClick={() => handleToggleConnect(peer.id)}
                style={{ fontSize: "11px", padding: "3px 8px" }}
              >
                {isConnected ? "Connected" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
