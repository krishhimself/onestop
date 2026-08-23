"""
Documents this app's shape, MongoDB doesn't enforce it. Kept here so anyone
(human or agentic IDE) touching user_repository.py knows exactly what a users
document looks like.

users collection:
{
  "_id": str (uuid4),
  "email": str,            # stored lowercased; unique, see note below
  "hashed_password": str,  # bcrypt, never the plaintext
  "role": "candidate" | "employer",
  "name": str | None,      # real display name; not collected at registration yet,
                           # so it is absent on every account created so far
  "revealed": bool,        # default False — see the anonymity note below
  "created_at": datetime (UTC),
}

The password is never stored or logged in any other form, and no query in
user_repository.py returns it except the one login needs.

Anonymity note: `revealed` drives the anonymous-first funnel. While it is False,
GET /profile/{user_id} answers with "Anonymous Candidate" and no email — the
identifying fields are dropped in services/reputation_service.py, not merely
hidden in the UI, so a profile response never carries a name or an address the
viewer is not entitled to.

It is a one-way latch: reputation_service flips it to True the first time the
candidate clears the reveal threshold, and nothing sets it back. Accounts created
before this field existed have no `revealed` key at all; every read treats a
missing value as False, so the safe state is also the default.
"""
