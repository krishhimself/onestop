import { useEffect, useState } from "react";
import Avatar from "../../../shared/components/Avatar";
import { UserIcon } from "../../../shared/components/Icons";
import { fetchConnections } from "../../community/api";
import { getUserId } from "../../../shared/api/token";

/**
 * Who you are connected to.
 *
 * Deliberately not "suggested peers": there is no discovery endpoint, because
 * ranking strangers for each other is a product decision nobody has made here.
 * Listing what exists is honest; inventing candidates to fill a sidebar is not.
 *
 * Names come from the API already resolved, so an unrevealed connection appears
 * as a pseudonym for exactly as long as they are one on their profile.
 */
export default function ConnectionsList({ onOpenProfile, refreshKey }) {
  const userId = getUserId();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchConnections(userId)
      .then((data) => live && setConnections(data?.connections ?? []))
      .catch((e) => live && setError(e.message || "Failed to load connections."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  return (
    <aside className="sidebar-widget">
      <div className="sidebar-widget-title">
        <UserIcon size={13} style={{ color: "var(--text-subtle)" }} />
        <span>Your Connections{connections.length ? ` (${connections.length})` : ""}</span>
      </div>

      {loading ? (
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading...</p>
      ) : error ? (
        <p style={{ fontSize: "12px", color: "var(--accent)" }}>{error}</p>
      ) : connections.length === 0 ? (
        <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          No connections yet. Open someone's profile from the feed to connect — it is
          instant and mutual, with nothing to accept.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {connections.map((person) => (
            <div key={person.user_id} className="peer-row">
              <div className="peer-info">
                <Avatar
                  name={person.name}
                  size="sm"
                  revealed={person.revealed}
                  role="candidate"
                  showBadge
                />
                <div className="peer-text">
                  <span className="peer-name">{person.name}</span>
                  <span className="peer-role">
                    {person.revealed ? "Revealed" : "Anonymous"}
                  </span>
                </div>
              </div>

              {onOpenProfile && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenProfile(person.user_id)}
                  style={{ fontSize: "11px", padding: "3px 8px" }}
                >
                  View
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
