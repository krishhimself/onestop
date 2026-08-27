# OneStop — a job platform that verifies comprehension, not credentials

## Thesis

Existing platforms (LinkedIn, Naukri, Indeed, Glassdoor) verify *claims* — a
resume, a headline, a list of skills. In a world where AI writes both the code
and the resume, claims are cheap.

OneStop verifies **understanding** instead, and it does so on both sides of the
market:

- A candidate's claim is their repo. The **repo quiz** tests whether they can
  explain what they built without the source in front of them.
- A company's claim is its posting. The **posting quiz** tests whether the
  person publishing the role actually knows what the role is. A posting exists
  only as the output of a defended quiz — there is no ungated "create job" route.

Everything else on the platform hangs off those two facts.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the layer-by-layer layout
and per-feature request flows.

---

## The four modes

All four are built and wired end to end. Three of them share one engine
(`app/services/quiz_service.py` + `app/integrations/gemini_client.py`): same
75-second clock, same silent paste recording, same single adaptive follow-up
before anything is graded. Bug Hunt is the exception and is called out below.

| Mode | Who takes it | What it proves | Endpoint |
|---|---|---|---|
| Repo quiz | Candidate | You understand code you wrote | `POST /quiz/generate` |
| Posting quiz | Employer | You understand the role you're advertising | `POST /jobs/company-quiz/generate` |
| Day-1 Readiness | Candidate applying to a job | You can orient in code you've never seen | `POST /quiz/day1/generate` |
| Bug Hunt | Candidate | You'd notice if your own code broke | `POST /quiz/bughunt/generate` |

### 1. Repo quiz — comprehension of your own code

1. Candidate pastes a public GitHub repo URL.
2. `github_client.fetch_repo_files()` pulls up to 12 source files — largest
   first, binaries/locks/build output skipped, 4 KB per file — and Gemini
   generates five questions grounded in what is actually there, across four
   categories:
   - **problem** — what this solves, who for, why it matters
   - **logic** — how the core mechanism works, end to end
   - **stack** — why these libraries and design choices over alternatives
   - **usage** — what happens when someone uses it, failure cases included
3. The candidate answers live under a per-question clock, no re-rolls.
4. Before anything is graded, one adaptive follow-up pushes on the candidate's
   own wording, drawn from whichever answer looks least likely to be theirs.
5. Gemini grades the reasoning, not the vocabulary, weighting the follow-up
   heavily. A confident, correct explanation in the candidate's own words scores
   well with no code quoted; answers vague enough to describe any project score
   zero.

Deliberately **not** line-number or syntax trivia. "Why did you slice
`text[4:]`?" is a question a stranger can answer off the diff and the actual
author can fail out loud. The questions are meant to be answerable by whoever
genuinely built the thing, from memory.

The same generation call also returns a **project complexity tier** — see
[Known limitations](#known-limitations).

Try it on this repo's own URL — that's intentional.

### 2. Posting quiz — comprehension of the role you're hiring for

A resume is a claim about a person; a job posting is a claim about a role. Both
are cheap to generate and both are usually written by someone other than the
person who will live with them. So the company side runs the same interrogation
in reverse.

1. An employer writes the draft — company, role, description, stack, and
   optionally a trial repo URL.
2. The same engine generates questions grounded in that draft, in four
   categories: **role** (day to day, and what "doing well" looks like at 90
   days), **stack** (which listed technologies the hire actually touches, and
   why each is there), **team** (who they work with, who decides what gets
   built), **reality** (the constraints, the legacy, what makes it hard).
3. Same clock, same silent paste recording, same single adaptive follow-up.
4. The posting is published **only** at 70/100 or better
   (`company_quiz_service.PASS_SCORE`).

Two properties the code enforces rather than merely intends:

- **The posting that goes live is the draft the questions came from.** It is
  stored server-side at generation time and copied into the jobs collection on a
  pass, so a company cannot answer honestly about the real role and then publish
  a rosier version of it.
- **Grading cannot be replayed.** A graded attempt is terminal: it keeps the
  `job_id` it produced, and a retried call returns that stored outcome instead of
  minting a second posting.

What this catches is a posting nobody behind it can account for — a listing with
Kafka and Kubernetes next to a description that only mentions FastAPI and Mongo
gets asked where Kafka actually sits in that flow. A template cannot survive
that; the engineer who owns the pipeline answers it without thinking.

### 3. Day-1 Readiness — comprehension of code you've never seen

Traditional technical interviews almost universally test **writing fresh code**:
leetcode puzzles, greenfield take-homes, blank-canvas live coding. Actual
day-to-day engineering is overwhelmingly **reading and navigating existing
codebases someone else wrote**. Day-1 Readiness measures the skill every
conventional interview skips.

1. When posting a role, an employer can attach a `trial_repo_url` — their own
   public repo or any representative open-source codebase.
2. A candidate applying to that job is routed through the Day-1 quiz first. The
   platform fetches files from the *employer's* repo and generates questions in
   four orientation categories:
   - **orientation** — what a given module or service is actually for
   - **navigation** — where a specific change would need to be made
   - **blast radius** — what breaks if a function, schema, or invariant changes
   - **data flow** — how data moves between two named files or layers
3. Same clock, same paste detection, same adaptive follow-up defence.
4. The graded score lands on the application document for the employer to
   review, and appears as an independent `day1_readiness` component in the
   candidate's reputation — **never blended into** the repo comprehension score.
   The separation is enforced at the query layer: comprehension reads
   `type != "day1"`, readiness reads `type == "day1"`.

### 4. Bug Hunt — would you notice if your own code broke?

Anyone can describe what happy-path code does in an interview. Bug Hunt asks
whether you'd spot a subtle break in code you claim to have written.

1. Gemini takes the candidate's own source files and returns working copies with
   2–3 realistic bugs injected: boundary off-by-ones, inverted conditions,
   unhandled empty-collection cases, in-place mutation of a shared collection,
   swallowed exceptions. Explicitly **never** syntax errors or anything a linter
   would catch — the code stays valid.
2. **The answer key never crosses the wire.** Ground-truth bugs and their line
   hints are written to the attempt document server-side; the generation response
   carries only the modified files and a bug *count*. There is nothing to read
   out of the network tab.
3. The candidate reads the code in an interactive workspace and files findings —
   file, suspected location, and an explanation of cause and consequence.
4. The server grades findings against the ground truth on both detection
   (caught vs. missed) and explanation depth, and returns per-bug feedback,
   including whether the candidate hallucinated bugs in valid code.

**How Bug Hunt differs from the other three, concretely:**

- The clock is **180 seconds for the whole workspace**, not 75 per question.
- That countdown is a plain one-second tick, not the wall-clock calculation the
  quiz timer uses — so backgrounding the tab can slow it. The quiz timer is not
  vulnerable to this; Bug Hunt's is.
- There is **no adaptive follow-up round**. Grading happens on submission.
- Bug Hunt scores do **not** currently feed the reputation breakdown. Attempts
  are stored with `status: "completed"`, and every reputation query reads
  `status: "graded"`. The score is returned to the candidate and stored; it is
  not yet part of the number an employer sees.

---

## Anti-gaming defences

The obvious attack is to paste the question into a chatbot and paste the answer
back. Three things make that expensive.

**A 75-second clock per question.** It starts when the question renders and is
derived from wall-clock time (`Date.now()` against a start timestamp) rather than
accumulated ticks, so backgrounding the tab does not buy extra seconds. When it
expires the answer commits as-is — blank included — and the box locks. Time
remaining at commit is recorded, because a long polished answer submitted with
most of the clock unspent was not composed in the box.

**Paste is detected, not blocked.** Blocking only teaches a candidate to retype
what they pasted; recording tells us which answer to interrogate. React fires one
change event per input, so ordinary typing arrives as a stream of single-character
deltas — a single event adding more than 40 characters within 100 ms of the last
one did not come from a keyboard. That answer is silently marked with the size of
the largest injection. Nothing is prevented and no warning is shown, so the paste
appears to have worked. The gap check is what keeps IME composition, autocomplete,
and deleting a large selection from tripping it
(`frontend/src/features/quiz/pasteDetect.js`, 23 unit tests including the known
gaps).

**One adaptive follow-up, before grading.** Once answers are in,
`pick_suspect_answer()` selects the answer least likely to have been typed by its
author. A recorded paste wins outright — it is evidence rather than inference —
with ties going to the largest single injection. Failing that, typing rate
weighted by length, so a suspiciously fast essay outranks a fast one-liner. A
single follow-up is generated that quotes that answer's specific wording back and
pushes on it. Same clock, same rules. **Grading happens only after this round**,
so a candidate cannot bank a score and abandon the round they cannot pass.

Measured manually on `psf/requests`, same repo and same time budget:

| Profile | Behaviour | Score |
|---|---|---|
| Pasted AI answer | committed with 63s of 75s left, could not defend its wording | **0/100** |
| Genuine author | typed distinct answers, defended the follow-up | **100/100** |

### What the defences do not do

**The timer and the paste detector are client-side.** They raise the cost of
casual cheating; they do not stop anyone willing to call the API directly with a
forged `seconds_left` and `flagged_paste: false`. Server-issued timestamps at
generation, with elapsed time computed server-side, are the real fix and are not
built yet.

**Detection has known seams**, and the test suite names them: pasting after a
pause longer than 100 ms clears the timing guard, and dictation software can
legitimately commit a long phrase in one event.

**A text-only quiz cannot fully stop a second screen.** Nothing here prevents a
candidate from reading the question off one monitor and an LLM's answer off
another. That is the honest limit of the format — which is exactly why the
follow-up round exists. It is generated from the candidate's own wording at
response time, under the same clock, so it cannot be prepared in advance and
cannot be answered by anyone who did not understand the answer they just gave.
The follow-up is the measure that actually holds; the timer and the paste
detector only make it harder to reach.

---

## The rest of the platform

**Auth with two roles.** Register as `candidate` or `employer`; the role is baked
into the JWT and drives both routing and authorisation. Employer-only endpoints
sit behind `get_current_employer`, and the frontend refuses to render the repo
quiz or Bug Hunt tabs for an employer account. Passwords are bcrypt-hashed and
never returned by any query but the login one; login answers identically for an
unknown email and a wrong password, so it cannot be used to enumerate accounts.

**Anonymous-first funnel.** Every account starts as "Anonymous Candidate".
Employers browse pseudonyms and learn who someone is only once that candidate has
a defended quiz at 70 or better (`reputation_service.REVEAL_MIN_SCORE`) — the
code earns the introduction, not the CV. Identity is dropped in the service
layer, not hidden in the UI: an unrevealed profile carries no name and no email
anywhere in the response. Reveal is evaluated on read (so a threshold change
applies immediately, with no migration) and latched once it flips.

**Reputation as a breakdown, never one number.** `GET /users/{id}/reputation`
returns `comprehension` (mean of defended repo-quiz scores), `day1_readiness`
(mean of defended Day-1 scores, kept separate), `rounds_reached`, and
`quiz_count` alongside the `overall`. The overall is
`0.75 × comprehension + 0.25 × rounds`, where rounds saturate at four so the
score cannot be farmed by volume of applications. A candidate averaging 92 across
one quiz and one averaging 92 across six are not the same candidate, and the
payload has to make that visible.

**Community, and what is deliberately absent.** Connections are instant and
mutual — one document per pair, no request, no approval, no pending state — and a
post is text that gets created and listed (2000 characters, 20 per page). Left
out on purpose, each one a schema change rather than a flag, so the feed cannot
drift into a social network by default: direct messages, threaded replies and
comments, likes/reactions/any engagement counter, approval-required connections,
media in posts. An unrevealed candidate is a pseudonym in the feed and in a
connections list for exactly as long as they are one on their profile: names
resolve at read time, and an unrevealed one is never in the payload at all.

**Jobs and applications.** Browse listings, apply (routed through the Day-1 test
when the posting has a trial repo attached), and — for employers — review
applicants with their comprehension and Day-1 scores and move them through
`applied → reviewed → accepted / rejected`. Only the employer who posted a job
can touch its applications.

---

## Known limitations

**Comprehension is not difficulty.** A simple project can legitimately score
100/100 on itself. If someone understands their to-do app completely, they
*should* score full marks — but that number says nothing about whether the to-do
app was hard to build. A raw comprehension score, alone, is not a measure of
engineering ability.

*Current mitigation:* the score is never shown as one opaque number. Every result
renders the full per-question breakdown next to a separate **project complexity
tier** (`trivial` / `moderate` / `complex`, or `unknown` if the model will not
commit), judged from signals in the repo itself — file count, async and
concurrency patterns, external API calls, state management, error handling, tests
— and explicitly *not* from how hard the generated questions happen to be. A
perfect score on a trivial project is therefore visible as exactly that, rather
than being indistinguishable from a perfect score on a complex one.

*The real fix, still on the roadmap:* difficulty-calibrated scoring, weighting
each question by how hard it proves to be population-wide. That needs answer data
across many candidates, which does not exist yet. The complexity tier is a
deliberate stopgap — a second, independent signal — not a substitute.

**A text-only quiz cannot fully stop AI answering on a second screen.** See
[What the defences do not do](#what-the-defences-do-not-do). The client-side
clock and paste detector are forgeable by anyone calling the API directly, and no
browser-side measure can see a second monitor. The adaptive follow-up is the
defence that actually holds, because it demands understanding at response time
regardless of how the request was made.

**Every grade is a single model judgement.** There is no second opinion, no
rubric calibration across candidates, and no appeal path.

**`POST /jobs/apply` is unauthenticated** and takes `user_id` in the body, so an
application can currently be filed on someone else's behalf. Every other
quiz and application route is token-bound; this one has not been brought in line
yet.

---

## Running locally

Prerequisites: Python 3.11+, Node 20+, a MongoDB connection string, and a Gemini
API key.

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload                      # http://localhost:8000
```

`backend/.env.example` holds exactly five keys:

| Key | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | Atlas or local; falls back to `mongodb://localhost:27017` if unset |
| `GEMINI_API_KEY` | yes | all four modes call Gemini |
| `GEMINI_MODEL` | no | defaults to `gemini-3.6-flash`; confirm the current name in Google AI Studio |
| `GITHUB_TOKEN` | no | raises the GitHub API rate limit from 60/hr to 5000/hr |
| `JWT_SECRET` | yes for anything real | the code ships a dev placeholder so the app boots in CI; override it anywhere issuing real tokens |

Nothing calls `os.getenv()` outside `app/core/config.py`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # VITE_API_BASE, defaults to http://localhost:8000/api/v1
npm run dev                  # http://localhost:5173
```

React 18 + Vite 5, no router and no state library — tabs are `useState` in
`App.jsx`, and the access token lives in browser storage.

### Or both via Docker

```bash
docker compose up --build
```

Reads `backend/.env` for the backend and injects `VITE_API_BASE` for the
frontend. Both services bind-mount their source for live reload.

## Tests

```bash
cd backend && pytest tests    # 232 tests; Gemini and Mongo are always mocked
cd frontend && npm test       # 23 tests via node:test, no runner dependency
```

The backend suite is hermetic by design — it never spends API quota, never needs
credentials, and passes with no `.env` present. If a test in that package makes a
real network call, that is a bug in the test.

CI (`.github/workflows/ci.yml`) runs the backend suite on Python 3.11 and the
frontend tests plus a production build on Node 20, for every PR and every push to
`main`.

## Status

**Built:** repo quiz end to end (generate → answer → follow-up → grade); the
company-side quiz gating job postings; the Day-1 Readiness test on employer trial
repos; Bug Hunt with server-side answer keys; auth with candidate/employer roles;
the anonymous-first funnel and reveal threshold; the reputation breakdown;
connections and a text-only feed; job listing, application, and applicant review.

**Designed, not yet built** (see `docs/ARCHITECTURE.md` for where these slot in):
server-issued timing, difficulty-calibrated scoring, Bug Hunt feeding reputation,
and the full reputation score replacing the single-quiz reveal threshold.
