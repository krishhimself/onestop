import { useEffect, useState } from "react";
import { getProfile } from "./api";
import { displayName } from "./display";
import { getUserId } from "../../shared/api/token";
// Connecting is a community action performed from a profile, so the call lives
// with the rest of the community API rather than being duplicated here.
import { connectTo } from "../community/api";

// Anonymous-first: a candidate is a pseudonym here until a defended quiz score
// clears the reveal threshold, at which point the backend latches them open and
// this page starts showing who they are. The reveal is evaluated server-side on
// every read, so simply revisiting this page after passing is enough.
export default function ProfilePage({ userId, onUnauthorized, onViewReputation }) {
  const subject = userId ?? getUserId();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // Connections are instant and mutual, so this has two states rather than
  // three: not connected, and connected. There is no pending.
  const [connection, setConnection] = useState(null);

  // Only when looking at somebody else — connecting to yourself is a 400.
  const viewingSomeoneElse = Boolean(subject) && subject !== getUserId();

  async function handleConnect() {
    setConnection({ busy: true });
    try {
      const result = await connectTo(subject);
      setConnection({ done: true, created: result.created });
    } catch (e) {
      if (e.status === 401) return onUnauthorized?.();
      setConnection(null);
      setError(e.message);
    }
  }

  useEffect(() => {
    let live = true;
    if (!subject) {
      setError("No profile to show.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getProfile(subject)
      .then((data) => live && setProfile(data))
      .catch((e) => {
        if (!live) return;
        if (e.status === 401) return onUnauthorized?.();
        setError(e.message);
      })
      .finally(() => live && setLoading(false));
    // Ignore a response that arrives after the subject changed or the page left.
    return () => {
      live = false;
    };
  }, [subject]);

  if (loading) return <div className="container">Loading profile...</div>;
  if (error) return <div className="container"><p className="error">{error}</p></div>;

  const revealed = Boolean(profile?.revealed);

  return (
    <div className="container">
      <h1>{displayName(profile)}</h1>
      <p className="tagline">{profile?.role === "employer" ? "Employer" : "Candidate"}</p>

      <div className="profile-card">
        {revealed ? (
          <>
            <p className="reveal-state revealed">Revealed</p>
            {profile.email && <p className="s">{profile.email}</p>}
            <p className="s">
              A defended quiz score cleared the threshold, so employers browsing
              this profile now see who you are.
            </p>
          </>
        ) : (
          <>
            <p className="reveal-state">Anonymous</p>
            <p className="s">
              Your name and email are not sent to anyone viewing this page. Score
              70 or better on a repo quiz and your identity is revealed here.
            </p>
          </>
        )}

        {viewingSomeoneElse && (
          <p className="s">
            {connection?.done ? (
              <span className="reveal-state revealed">
                {connection.created ? "Connected" : "Already connected"}
              </span>
            ) : (
              <button type="button" onClick={handleConnect} disabled={connection?.busy}>
                {connection?.busy ? "Connecting..." : "Connect"}
              </button>
            )}
          </p>
        )}

        {/* The reveal is one thing this profile says about a candidate; the
            reputation breakdown is the rest of it, and it lives on its own page
            rather than being summarised into a number here. */}
        {onViewReputation && (
          <p className="s">
            <button type="button" className="linkish" onClick={onViewReputation}>
              View reputation breakdown
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
