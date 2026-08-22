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

## Status

**Built:** repo quiz end to end (generate → answer → grade), minimal job
posting/application CRUD.

**Designed, not yet built** (see `docs/ARCHITECTURE.md` for where these
slot in): company-side quiz gating job postings, anonymous-first candidate
profiles, unified reputation score, bug-hunt mode, community threads.

## Running locally

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in MONGO_URI, GEMINI_API_KEY
uvicorn app.main:app --reload
```

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
cd backend && pytest tests
```
