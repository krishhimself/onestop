# Architecture

## Layers (backend)

Request flows in one direction only. Each layer only knows about the one below it.

```
api/v1/endpoints/*.py   HTTP in/out. Parses requests, maps exceptions to
                        HTTP status codes. No business logic.
        │
services/*.py           Business logic. Orchestrates integrations +
                         repositories. This is where "what should happen"
                         lives.
        │
   ┌────┴─────┐
integrations/  repositories/
external APIs  MongoDB access
(GitHub,       (one file per
 Gemini)        collection)
```

Rule of thumb: if you're adding a new feature, you're adding a schema, a
service function, and an endpoint that calls it. If it needs external data,
it goes through `integrations/`. If it needs storage, it goes through
`repositories/`.

## Why layered instead of one flat `main.py`

Two reasons specific to this project:

1. **The grading criteria include code quality**, and a clean layer
   boundary is the fastest way to demonstrate engineering judgment in a
   two-week solo project.
2. **Working with an agentic IDE (Antigravity) goes better with clear
   boundaries.** When each file has one job and a docstring saying what
   it is, an agent (or a human skimming fast) can find the right place
   to make a change without re-deriving the whole app's structure first.

## Request flow example — generating a repo quiz

```
POST /api/v1/quiz/generate
  → api/v1/endpoints/quiz.py::generate()
    → services/quiz_service.py::create_quiz()
      → integrations/github_client.py::fetch_repo_files()   (GitHub API)
      → integrations/gemini_client.py::generate_quiz_questions()  (Gemini)
      → repositories/quiz_repository.py::save_attempt()     (Mongo)
    ← QuizGenerateResponse
  ← 200 JSON
```

## Frontend structure

```
features/<name>/         One folder per product feature (quiz, jobs, ...).
  api.js                 Calls shared/api/client.js — never fetch() directly.
  components/             Feature-local components.
  <Name>Page.jsx          Top-level page, composes the components + api.

shared/
  api/client.js           The only file that calls fetch() against the backend.
  components/, hooks/      Cross-feature reusable pieces.
```

Adding a feature = a new folder under `features/`. Nothing in `shared/`
should ever import from a `features/` folder — dependencies point inward.

## What's next architecturally (not yet built)

- `auth` module (backend) + `features/auth` (frontend) — needed before the
  anonymous-first funnel can gate anything for real.
- `services/scoring_service.py` — the unified reputation score
  (quiz depth + interview rounds elsewhere). Reads from quiz + application
  outcomes, writes to a `scores` collection via a new `score_repository.py`.
- `services/company_quiz_service.py` — same quiz engine, different prompt,
  gates job posting creation.
