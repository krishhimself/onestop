"""
Business logic for the anonymous-first funnel.

A candidate is a pseudonym until their work says otherwise. Employers browse
"Anonymous Candidate" profiles and only learn who someone is once that candidate
has demonstrated something — which is the whole point of the platform: the code
earns the introduction, not the CV.

Two things live here:

  * `meets_reveal_threshold` — has this candidate earned it yet? Today that is a
    single graded quiz at or above REVEAL_MIN_SCORE. The real reputation score
    (quiz depth + interview rounds, per docs/ARCHITECTURE.md) replaces the body of
    this one function; nothing else below has to change when it lands.
  * `get_public_profile` — assembles what a viewer is allowed to see.

Identity is dropped here, in the service, rather than hidden in the UI. An
unrevealed profile has no name and no email anywhere in the response, so there is
nothing for a curious viewer to read out of the network tab.
"""
from app.repositories import quiz_repository, user_repository

ANONYMOUS_NAME = "Anonymous Candidate"

# One defended quiz at 70+ is the current bar. Deliberately a module constant:
# the tests assert against this rather than a literal, so moving the bar cannot
# quietly leave the suite asserting the old one.
REVEAL_MIN_SCORE = 70.0


async def meets_reveal_threshold(user_id: str) -> bool:
    """
    Placeholder for the real reputation score.

    For now: does this candidate hold at least one graded attempt scoring
    REVEAL_MIN_SCORE or better? Grading only happens after the follow-up defence,
    so a passing score here already means the answers survived being questioned.
    """
    return await quiz_repository.has_graded_attempt_scoring_at_least(user_id, REVEAL_MIN_SCORE)


async def get_public_profile(user_id: str) -> dict:
    """
    The profile as a viewer may see it, revealing the candidate if they have earned it.

    Reveal is evaluated on read rather than written at grading time so that a
    change to the threshold applies to everyone immediately, without a migration
    over past attempts. The flag is still persisted once it flips: it is a latch,
    so a candidate who was revealed stays revealed even if the bar later rises.

    Raises LookupError for an unknown user; the endpoint turns that into a 404.
    """
    user = await user_repository.get_user_by_id(user_id)
    if not user:
        raise LookupError("user_not_found")

    revealed = bool(user.get("revealed"))
    if not revealed and await meets_reveal_threshold(user_id):
        await user_repository.mark_revealed(user_id)
        revealed = True

    if not revealed:
        return {
            "user_id": user["_id"],
            "name": ANONYMOUS_NAME,
            "email": None,
            "role": user.get("role", "candidate"),
            "revealed": False,
        }

    return {
        "user_id": user["_id"],
        # `name` is not collected at registration yet, so it is None on every
        # account so far. The profile view falls back to the email in that case;
        # both are the candidate's to show once revealed.
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role", "candidate"),
        "revealed": True,
    }
