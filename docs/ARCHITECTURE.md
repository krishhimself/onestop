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

## Request flow example - viewing a profile

```
GET /api/v1/profile/{user_id}
  -> api/v1/endpoints/profile.py::get_profile()
    -> services/reputation_service.py::get_public_profile()
      -> repositories/user_repository.py::get_user_by_id()      (Mongo)
      -> repositories/quiz_repository.py                        (Mongo)
           ::has_graded_attempt_scoring_at_least()
      -> repositories/user_repository.py::mark_revealed()       (Mongo, only on
                                                                 the first reveal)
    <- ProfileResponse
  <- 200 JSON
```

Identity is dropped in the service, not in the UI: while `revealed` is False the
response carries `"Anonymous Candidate"` and a null email, so an unrevealed name
never reaches the browser at all. `features/profile/display.js` re-checks the flag
as a second lock.

## Request flow example - posting a job

A posting is the output of a defended quiz, not an input to one. There is no
ungated create route: `job_service.post_job()` has exactly one caller.

```
POST /api/v1/jobs/company-quiz/generate      (employer token required)
  -> api/v1/endpoints/jobs.py::generate_company_quiz()
    -> services/company_quiz_service.py::create_quiz()
      -> integrations/gemini_client.py::generate_company_quiz_questions()  (Gemini)
      -> repositories/company_quiz_repository.py::save_attempt()  (Mongo, holds the draft)

POST /api/v1/jobs/company-quiz/submit
  -> services/company_quiz_service.py::start_followup()
    -> services/quiz_service.py::pick_suspect_answer()          (same ranking as the repo quiz)
    -> integrations/gemini_client.py::generate_followup_question(framing=COMPANY_FRAMING)

POST /api/v1/jobs/company-quiz/followup
  -> services/company_quiz_service.py::grade_and_post()
    -> integrations/gemini_client.py::grade_company_answers()   (Gemini)
    -> services/job_service.py::post_job()                      (Mongo, ONLY on a pass,
                                                                 from the stored draft)
    -> repositories/company_quiz_repository.py::update_result()
  <- CompanyQuizResultResponse {score, passed, job_id}
```

Two properties the layering exists to protect:

* The posting that goes live is the draft the questions were generated from, so a
  company cannot defend an honest draft and publish a different one.
* `status: "graded"` is terminal and carries the job_id it produced, so a replayed
  final call returns the stored outcome instead of minting a second posting.

Company attempts live in their own collection rather than in `quiz_attempts` with a
discriminator: `quiz_repository.has_graded_attempt_scoring_at_least()` backs the
candidate reveal threshold and matches any graded attempt by user, so a shared
collection would let an employer quiz count as candidate comprehension.

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

- The real reputation score. `services/reputation_service.py` exists and owns the
  anonymous-first funnel, but `meets_reveal_threshold()` is a placeholder: one
  graded quiz at `REVEAL_MIN_SCORE` or better. The unified score (quiz depth +
  interview rounds elsewhere) replaces the body of that one function — it reads
  from quiz + application outcomes and writes to a `scores` collection via a new
  `score_repository.py`. Nothing else in the funnel changes when it lands.
- Company-side bug-hunt and community threads, per the README status list.
  Nothing about them is designed yet.
