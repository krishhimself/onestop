"""
connections collection:
{
  "_id": str (uuid4),
  "users": [str, str],       # the pair, sorted — see connection_repository.pair()
  "created_at": datetime (UTC),
}

One document per connection, not two. Connections are instant and mutual, so
there is no direction to record and no status field: a document existing IS the
connection. There is deliberately no `pending`, `requested_by`, or `accepted_at`
— an approval flow is roadmap, not scope.

posts collection:
{
  "_id": str (uuid4),
  "author_id": str,          # from the access token, never from a request body
  "text": str,               # trimmed, 1..MAX_POST_LENGTH
  "job_id": str | None,      # optional reference to a jobs document
  "company_name": str | None,
  "created_at": datetime (UTC),
}

Append-only and text-only. No comment, like, reaction, or attachment storage
exists here, and adding any of them is a schema change rather than a flag —
which is the point: the feed cannot quietly grow into a social network.

Neither collection stores a display name. Names live in `users` and are resolved
at read time through community_service._display, so an unrevealed candidate is a
pseudonym in a feed and a connections list for exactly as long as they are one on
their profile.
"""
