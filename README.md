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
2. The backend pulls sample source files and has an LLM generate questions
   tied to specific function names, variables, and design choices in that
   code — not generic "what does this app do" questions.
3. The candidate answers live, no re-rolls.
4. The LLM grades for genuine comprehension vs. a vague, generic answer.

Try it on this repo's own URL once it's public — that's intentional.

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
