import { useEffect, useState } from "react";
import { getProfile } from "./api";
import { displayName } from "./display";
import { getUserId } from "../../shared/api/token";

// Anonymous-first: a candidate is a pseudonym here until a defended quiz score
// clears the reveal threshold, at which point the backend latches them open and
// this page starts showing who they are. The reveal is evaluated server-side on
// every read, so simply revisiting this page after passing is enough.
export default function ProfilePage({ userId, onUnauthorized, onViewReputation }) {
  const subject = userId ?? getUserId();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
