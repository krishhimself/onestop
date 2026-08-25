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

## Request flow example - the reputation score

```
GET /api/v1/users/{user_id}/reputation
  -> api/v1/endpoints/reputation.py::get_reputation()
    -> services/reputation_service.py::compute_reputation()
      -> repositories/user_repository.py::get_user_by_id()          (Mongo, 404s if absent)
      -> repositories/quiz_repository.py::graded_scores_for_user()  (Mongo)
      -> repositories/job_repository.py                             (Mongo)
           ::count_applications_with_status()
    <- ReputationResponse {overall, comprehension, quiz_count, rounds_reached}
  <- 200 JSON
```

The components are part of the response rather than an expansion of it. One
blended figure gets read as a measure of engineering ability, and it is not one:
a 92 average across one quiz and a 92 across six are different claims, and only
`quiz_count` says so. `features/reputation/ReputationPage.jsx` renders them in a
single return for the same reason `ScoreResult` does, and `ProfilePage` embeds that
component rather than restating the numbers: one copy of the rule is the only way it
stays true. Identity belongs to the profile view, what was demonstrated belongs to
this one.

Which statuses count as a round reached is the service's decision, not the
repository's — `count_applications_with_status()` only counts what it is handed.

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

**A page that renders data it did not fetch is the failure mode to watch for.** The
2026-08-25 redesign briefly left three screens rendering mock arrays while their
`api.js` clients sat unused next to them — the build stayed green, the tests stayed
green, and the app demoed fine, because nothing about a hardcoded array is a type
error. `features/jobs/api.js` also grew a `createJob()` posting to `/jobs/`, a route
that does not exist precisely so that it cannot.

Each feature page now has a `<Name>.test.jsx` beside it that mounts it in jsdom with
its `api.js` mocked and asserts the call happens. That is the cheap half. The other
half is that each of those tests also pins the one invariant its page owns — the
answer payload's clock and paste flag, grading strictly after the follow-up, the
overall score never rendering without its quiz count — so the suite fails on a page
that calls the API and then displays something else. Adding a `const INITIAL_*` array
next to a feature's `api.js` now breaks a test rather than a demo.

## What's next architecturally (not yet built)

- Wiring the reputation score into the reveal. `compute_reputation()` now exists
  and combines quiz depth with round history, but `meets_reveal_threshold()` is
  still its own placeholder: one graded quiz at `REVEAL_MIN_SCORE` or better. The
  two are deliberately not connected yet — the reveal is a one-way latch on a
  candidate's identity, and moving it onto a score whose weights are still
  guesses would latch accounts open on a formula nobody has calibrated. When it
  lands it replaces the body of that one function; nothing else in the funnel
  changes.
- Difficulty-calibrated scoring, per the README. `comprehension` is a flat mean
  of defended scores, so six trivial repos average the same as six hard ones.
  That needs answer data across many candidates before it can be calibrated.
- Server-issued generation timestamps for the quiz clock. Today `seconds_left`
  arrives from the client and is stored as given. The fix is a `generated_at` on
  the attempt and elapsed time computed in the service, which changes the quiz
  and company-quiz schemas together — the one item here that is a real schema
  change rather than a new function.
- Company-side bug-hunt and community threads, per the README roadmap. Nothing
  about them is designed yet.
