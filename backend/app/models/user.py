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
  "created_at": datetime (UTC),
}

The password is never stored or logged in any other form, and no query in
user_repository.py returns it except the one login needs.

Uniqueness note: email uniqueness is currently enforced by a read-before-write in
auth_service.register_user, which is racy under concurrent signups. A unique index
on `email` is the real fix:

    db.users.create_index("email", unique=True)
"""
