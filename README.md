# OneStop — a job platform that verifies comprehension, not credentials

## Thesis

Existing platforms (LinkedIn, Naukri, Indeed, Glassdoor) verify *claims* —
a resume, a headline, a list of skills. In a world where AI can write both
the code and the resume, claims are cheap. This platform verifies whether
a candidate actually **understands** what they built, and whether a
company's posting reflects what the role actually is — on both sides of
the market.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the technical layout.

## Core mechanism: the Repo Quiz

1. Candidate pastes a public GitHub repo link.
2. The backend pulls sample source files and has an LLM interrogate the
   candidate the way a hackathon jury would — grounded in what is actually
   in that repo, across four categories:
   - **problem understanding** — what this solves, who for, why it matters
   - **logic / reasoning** — how the core mechanism actually works, end to end
   - **tech stack awareness** — why these libraries and design choices, over alternatives
   - **usage / functionality** — what happens when someone uses it, failure cases included
3. The candidate answers live under a per-question clock, no re-rolls.
4. Before anything is graded, one adaptive follow-up pushes on the candidate's
   own wording from whichever answer looks least likely to be theirs.
5. The LLM grades the reasoning, not the vocabulary, weighing the follow-up
   heavily. A confident, correct explanation in the candidate's own words scores
   well with no code quoted; answers vague enough to describe any project score
   zero.

Deliberately **not** line-number or syntax trivia. "Why did you slice
`text[4:]`?" is a question a stranger can answer off the diff and the actual
author can fail out loud. The questions are meant to be answerable by whoever
genuinely built the thing, without the source in front of them.

Try it on this repo's own URL once it's public — that's intentional.

### Anti-gaming measures

The obvious attack is to paste the question into a chatbot and paste the answer
back. Three things make that expensive:

**A 75-second clock per question.** It starts when the question renders and is
derived from wall-clock time rather than accumulated ticks, so backgrounding the
tab does not buy extra seconds. When it expires the answer commits as-is — blank
included — and the box locks. Time remaining at commit is recorded, because a long
polished answer submitted with most of the clock unspent was not composed in the
box.

**Paste is detected, not blocked.** Blocking it only teaches a candidate to retype
what they pasted; recording it tells us which answer to interrogate. React fires one
change event per input, so ordinary typing arrives as a stream of single-character
deltas — a single event that adds a whole paragraph did not come from a keyboard.
That answer is silently marked. Nothing is prevented and no warning is shown, so the
paste appears to have worked.

**One adaptive follow-up, before grading.** Once answers are in, the answer least
likely to have been typed by its author is selected. A recorded paste wins outright,
since it is evidence rather than inference, with ties going to the largest single
injection; failing that, typing rate weighted by length, so a suspiciously fast essay
outranks a fast one-liner. A single
follow-up is generated that quotes that answer's specific wording back and pushes
on it. Same clock, same no-paste rule. Grading happens only after this round, so a
candidate cannot bank a score and abandon the round they cannot pass.

Measured on `psf/requests`, same repo and same time budget:

| Profile | Behaviour | Score |
|---|---|---|
| Pasted AI answer | committed with 63s of 75s left, could not defend its wording | **0/100** |
| Genuine author | typed distinct answers, defended the follow-up | **100/100** |

**What this does not do.** The timer and the paste detector are client-side. They
raise the cost of casual cheating; they do not stop anyone willing to call the API
directly with a forged `seconds_left` and `flagged_paste: false`. Detection also has
a seam of its own: pasting after a pause long enough to look like thinking clears the
timing guard, and dictation software can legitimately commit a long phrase in one
event. The follow-up round is the measure that actually holds, because it demands
understanding at response time regardless of how the request was made. Server-issued
timestamps at generation, with elapsed time computed server-side, are the real fix and
are not built yet.

### Known limitation: comprehension is not difficulty

A simple project can legitimately score 100/100 on itself. If someone
understands their to-do app completely, they *should* score full marks — but
that number says nothing about whether the to-do app was hard to build. A raw
comprehension score, on its own, is not a measure of engineering ability.

**Current mitigation.** The score is never shown as one opaque number. Every
result renders the full per-question breakdown alongside a separate
**project complexity tier** (`trivial` / `moderate` / `complex`), judged from
signals in the repo itself — file count, async and concurrency patterns,
external API calls, state management, error handling, tests — and explicitly
not from how hard the generated questions happen to be. A perfect score on a
trivial project is therefore visible as exactly that, rather than being
indistinguishable from a perfect score on a complex one.

**The real fix, still on the roadmap.** Difficulty-calibrated scoring:
weighting each question by how hard it proves to be population-wide, so scores
are comparable across candidates and projects. That needs answer data across
many candidates before it can be calibrated, which does not exist yet. The
complexity tier is a deliberate stopgap — a second, independent signal — not a
substitute for it.

## The other side: the posting quiz

A resume is a claim about a person; a job posting is a claim about a role. Both are
cheap to generate and both are usually written by someone other than the person who
will live with them. So the company side runs the same interrogation in reverse.

1. An employer writes the posting — company, role, stack, what the job actually is.
2. The same engine generates questions grounded in that posting, in four categories:
   - **role** — what this person does day to day, and what "doing well" looks like at 90 days
   - **stack** — which of the listed technologies the hire actually touches, and why each is there
   - **team** — who they work with, who decides what gets built
   - **reality** — the constraints, the legacy, what makes the role genuinely hard
3. Same 75-second clock, same silent paste recording, same single adaptive follow-up
   before anything is graded.
4. A posting is published **only** if the answers clear 70/100. Nothing else in the
   codebase creates a job: `job_service.post_job()` has exactly one caller, and it is
   the grading step.

The posting that goes live is the draft the questions were generated from, held
server-side for the whole round — so a company cannot answer honestly about the real
role and then publish a rosier version of it.

What this catches is a posting nobody behind it can account for. Asked about a
posting listing Kafka and Kubernetes next to a description that only mentions
FastAPI and Mongo, the first question generated back was where Kafka actually sits
in that flow — the kind of question a template cannot survive and the engineer who
owns the pipeline answers without thinking. A round answered with specifics and a
defended follow-up scored 98/100 and published; a round whose answers repeated
themselves and whose follow-up went undefended scored 52 and published nothing.

**Same seam as the candidate side.** The clock and the paste detector are
client-side, and the pass mark is a single model judgement. What holds is the
follow-up: it is generated from the employer's own wording at response time, so it
cannot be prepared in advance. Grading also cannot be replayed — an attempt is
graded once, keeps the job id it produced, and a retried call returns that instead of
publishing again.

## Status

**Built, end to end** — backend and UI, with the UI calling the API rather than
standing in for it:

| Capability | Notes |
|---|---|
| Repo quiz: generate → answer → follow-up → grade | 206 backend tests, 15 frontend |
| Per-question timer + silent paste recording | shared by both sides of the market |
| Complexity tier alongside every score | rendered next to the breakdown, never alone |
| JWT auth, register/login, employer vs candidate roles | role decides which flow you see |
| Anonymous-first funnel | reveal latches at 70+, evaluated on profile read |
| Company posting quiz gating publication | `PostJobPage` drives it; no ungated create path exists |
| Reputation score as a breakdown | `ReputationPage`, rendered inside the profile view |
| Connections + text-only post feed | instant mutual connect, text posts, nothing else |
| Job listing + applications | |

### Community: what is deliberately absent

Connections are instant and mutual — one document per pair, no request, no
approval, no pending state — and a post is text that gets created and listed.
Left out on purpose, each one a schema change rather than a flag so the feed
cannot drift into a social network by default:

- direct messages
- threaded replies and comments
- likes, reactions, any engagement counter
- approval-required connections (requests, accept/decline, blocking)
- media in posts

An unrevealed candidate is a pseudonym in the feed and in a connections list for
exactly as long as they are one on their profile: names are resolved at read time
from `users`, and an unrevealed one is never in the payload at all.

The feed UI draws no control for any of them. A like button with nothing behind it
is a claim the platform cannot keep, so the absence is visible rather than faked.

## Roadmap

Not built — each of these is missing a schema, a service, or a route. Listed here
so the Status table above stays a claim about what runs rather than what is
intended.

- **Reputation feeding the reveal threshold.** `compute_reputation()` exists;
  `meets_reveal_threshold()` is still its own placeholder at one graded quiz ≥ 70.
  Deliberately unconnected — the reveal is a one-way latch on someone's identity
  and the score's weights are still guesses. See `docs/ARCHITECTURE.md`.
- **Difficulty-calibrated scoring**, per the limitation above. Needs answer data
  across many candidates before there is anything to calibrate against.
- **Server-issued timestamps** for the quiz clock, so elapsed time is computed
  server-side instead of trusting a client-supplied `seconds_left`.
- **Bug-hunt mode** — the company-side counterpart to the repo quiz. Not designed.
- **Direct messages**, threaded replies, engagement counters, media in posts, and
  approval-required connections. Each is a schema change on purpose; see the
  section above for why they are absent rather than pending.
- **Score decay** over time, so a two-year-old quiz result does not read like a
  current one. Not designed.

## Running locally

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # see the table below
uvicorn app.main:app --reload
```

Everything in `.env` is read through `app/core/config.py` (pydantic-settings);
nothing outside that file calls `os.getenv()`. Every key has a default, so the
app boots with an empty `.env` — the defaults are what let it boot, not what
make it work.

| Key | Required | Default | Notes |
|---|---|---|---|
| `MONGO_URI` | yes | `mongodb://localhost:27017` | Atlas URI or a local mongod. |
| `GEMINI_API_KEY` | yes | empty | Every quiz route fails without it. |
| `GEMINI_MODEL` | no | `gemini-3.6-flash` | Confirm the current name in Google AI Studio. |
| `GITHUB_TOKEN` | no | empty | Unauthenticated GitHub allows 60 requests/hr, which one person testing can exhaust; any token raises it to 5000. No scopes needed — only public repos are read. |
| `JWT_SECRET` | **in any real deployment** | `dev-only-insecure-secret-change-me` | Signs access tokens. The default exists so dev and CI boot; anything issuing tokens a real user holds must override it. |
| `JWT_ALGORITHM` / `JWT_EXPIRE_MINUTES` | no | `HS256` / `720` | Rarely worth changing. |

The Gemini integration still runs on the legacy `google-generativeai` SDK. The
migration to `google-genai` has **not** happened; `integrations/gemini_client.py`
is the only importer, which is what keeps it a one-file change when it does.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # override VITE_API_BASE if needed
npm run dev
```

### Or both via Docker
```bash
docker compose up --build
```

## Tests
```bash
cd backend  && pytest tests     # 206 tests
cd frontend && npm test         # 62 tests: node --test, then vitest
```
Both are what CI runs (`.github/workflows/ci.yml`), alongside `npm run build`.

The frontend runs two suites, split by what they need:

| Command | Files | What it covers |
|---|---|---|
| `npm run test:unit` | `*.test.js` | Pure logic — paste detection, name display. No DOM, no transform. |
| `npm run test:render` | `*.test.jsx` | Feature pages mounted in jsdom, with `api.js` mocked. |

The render suite exists for one specific failure. A page that renders a hardcoded
array instead of calling its API passes a type check, passes the backend suite,
and builds clean — that is exactly what shipped on 2026-08-25 and stood for a day.
So every feature page has a test asserting it calls its own `api.js` on mount and
renders what came back, plus the invariant that page is responsible for: the quiz
sends every answer with its clock and paste flag, the employer round grades only
after the follow-up and never re-sends the draft, the profile never shows an
overall score without its quiz count, and the feed offers no control for anything
the backend cannot store. Run against the pre-fix commit, 15 of them fail.
