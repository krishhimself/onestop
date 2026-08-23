// What a viewer is shown for a candidate's identity.
//
// The backend already strips the name and email from an unrevealed profile, so
// this is the second of two locks rather than the only one: even if a payload
// arrived carrying identity it should not, `revealed` alone decides what renders.
// Kept as a plain function so it can be tested without a DOM.
export const ANONYMOUS_NAME = "Anonymous Candidate";

export function displayName(profile) {
  if (!profile?.revealed) return ANONYMOUS_NAME;
  // `name` is not collected at registration yet, so most revealed profiles fall
  // through to the email — which is the candidate's to show once revealed.
  return profile.name || profile.email || ANONYMOUS_NAME;
}
