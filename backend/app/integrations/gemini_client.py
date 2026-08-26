"""
Talks to the Gemini API. Nothing else in the app should import
google.generativeai directly — go through here so the model name
and prompt shape live in one place.
"""
import json

import google.generativeai as genai

from app.core.config import settings

genai.configure(api_key=settings.gemini_api_key)


def _model():
    return genai.GenerativeModel(settings.gemini_model)


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        text = text[4:] if text.startswith("json") else text
    return text.strip()


VALID_TIERS = ("trivial", "moderate", "complex")
UNKNOWN_COMPLEXITY = {
    "tier": "unknown",
    "reasoning": "The model did not return a usable complexity assessment.",
}


def _parse_questions(data) -> list[dict]:
    """Questions out of either shape the model returns: a bare array or {"questions": [...]}."""
    if isinstance(data, list):
        return data
    return data.get("questions") or []


def _parse_quiz_payload(text: str) -> tuple[list[dict], dict]:
    """
    Split the model's response into (questions, complexity).

    The model is asked for an object, but a bare array is still accepted so a
    malformed or older-style response degrades to an unrated quiz rather than
    failing the whole request.
    """
    data = json.loads(text)

    if isinstance(data, list):  # model ignored the object wrapper
        return _parse_questions(data), dict(UNKNOWN_COMPLEXITY)

    questions = _parse_questions(data)
    raw = data.get("complexity")
    if not isinstance(raw, dict):
        return questions, dict(UNKNOWN_COMPLEXITY)

    tier = str(raw.get("tier", "")).strip().lower()
    return questions, {
        "tier": tier if tier in VALID_TIERS else "unknown",
        "reasoning": str(raw.get("reasoning") or UNKNOWN_COMPLEXITY["reasoning"]),
    }


async def generate_quiz_questions(files: list[dict], n_questions: int = 5) -> tuple[list[dict], dict]:
    file_context = "\n\n".join(f"--- {f['path']} ---\n{f['content']}" for f in files)

    prompt = f"""You are a hackathon judge talking to the developer who built this
project. You have skimmed their code. Ask {n_questions} questions that test whether
they actually understand what they built and why.

Ask the kind of question a judge asks, not the kind a code reviewer asks. Do NOT ask
them to recite syntax, quote a line, or explain why a specific variable is named what
it is. Ask about intent, trade-offs, and consequences. A developer who genuinely built
this should be able to answer out loud, in their own words, without the code in front
of them.

Cover these four categories, at least one question each:
  problem - what problem this solves, who it is for, why it is worth solving
  logic   - how the core mechanism actually works, end to end
  stack   - why these libraries, services, or architectural choices, over alternatives
  usage   - what actually happens when someone uses it, including failure cases

Ground each question in something real from their code (a service, a data flow, a
dependency), but phrase it so it is answered with reasoning rather than recall.

Also rate how complex this project actually is. Base the tier ONLY on evidence in
the files you were given - how many files there are, whether there is async or
concurrent code, whether it calls external APIs or services, whether it manages
non-trivial state, how seriously it handles errors, and whether it has tests. Do NOT
base the tier on how hard your own questions are.
  trivial  - a script or toy; little structure, no real state, no external moving parts
  moderate - several cooperating modules, some external calls or state, partial error handling
  complex  - many interacting parts, concurrency or heavy external integration, real error and test coverage

Return ONLY a JSON object, no prose:
{{"questions": [{{"question": "...", "file_reference": "path/to/file.py", "category": "problem" | "logic" | "stack" | "usage"}}],
  "complexity": {{"tier": "trivial" | "moderate" | "complex", "reasoning": "one sentence citing what you saw in the files"}}}}

CODE:
{file_context}
"""
    response = await _model().generate_content_async(prompt)
    return _parse_quiz_payload(_strip_code_fence(response.text))


async def generate_day1_questions(files: list[dict], n_questions: int = 5) -> list[dict]:
    """
    Generate questions testing whether a developer reading this unfamiliar codebase
    for the first time can orient quickly.

    Grounded in the actual files and answerable only by genuinely reading them:
      orientation  - what a given module or component's purpose is
      navigation   - where a specific change or new feature would need to be made
      blast_radius - what would break if a particular piece or invariant were removed
      data_flow    - how data flows between two files or layers
    """
    file_context = "\n\n".join(f"--- {f['path']} ---\n{f['content']}" for f in files)

    prompt = f"""You are assessing a software engineer who has just opened this codebase for the first time.
Ask {n_questions} questions that test how fast and accurately they can orient themselves in an unfamiliar codebase.

The goal is to test Day-1 navigation and comprehension — whether someone genuinely reading these files can find their way around, understand the architecture, and reason about how pieces connect.

Cover these four core Day-1 orientation areas:
  orientation  - what a given module, class, or service's core purpose is
  navigation   - where in the codebase a specific change or feature addition would need to be made
  blast_radius - what would break or fail if a particular function, schema, or invariant were removed or altered
  data_flow    - how data flows between two specific files, services, or layers

Ground each question in the actual files provided. The questions must be answerable ONLY by genuinely reading and understanding the provided code, not general trivia, syntax questions, or textbook definitions.

Return ONLY a JSON object with a "questions" list, no markdown prose:
{{"questions": [{{"question": "...", "file_reference": "path/to/file.py", "category": "orientation" | "navigation" | "blast_radius" | "data_flow"}}]}}

CODEBASE:
{file_context}
"""
    response = await _model().generate_content_async(prompt)
    return _parse_questions(json.loads(_strip_code_fence(response.text)))


# How the follow-up addresses whoever is answering. The generator itself is identical
# for both sides of the market - only the framing changes, so a company defending its
# own posting is pushed on exactly as hard as a candidate defending their code.
CANDIDATE_FRAMING = {
    "opening": "A developer was asked this about a project they claim to have built",
    "topic": "the project",
}
COMPANY_FRAMING = {
    "opening": "The person who wrote a job posting was asked this about the role they are hiring for",
    "topic": "the role",
}


async def generate_followup_question(
    question: dict, answer: str, framing: dict = CANDIDATE_FRAMING
) -> str:
    """
    One sharp follow-up that pushes on the answerer's own wording.

    The point is not to ask something harder - it is to ask something that is only
    answerable by whoever actually meant what they wrote. A pasted answer has no
    author behind it to defend it.
    """
    prompt = f"""{framing["opening"]}:

QUESTION: {question.get("question", "")}

THEIR ANSWER: {answer}

Write ONE short follow-up question that quotes or directly references specific wording
from THEIR ANSWER and pushes on it. Ask what that specific claim implies, what happens
at its edges, or what the consequence is if it fails.

Example shape: "You said X handles the empty case by Y - what does the caller see if Y
throws?"

It must be unanswerable by someone who did not mean what they wrote. Do not ask a
general question about {framing["topic"]}. Do not ask them to quote code.

Return ONLY the question text. No prose, no JSON, no quotes around it.
"""
    response = await _model().generate_content_async(prompt)
    return response.text.strip().strip('"')


async def grade_answers(
    questions: list[dict], answers: list[dict], followup: dict | None = None
) -> dict:
    qa_pairs = "\n\n".join(
        "Q: {q}\nA: {a}".format(
            q=q["question"],
            a=next((a["answer"] for a in answers if a["question_id"] == q["id"]), "(no answer)"),
        )
        for q in questions
    )

    followup_block = ""
    if followup and followup.get("question"):
        followup_block = f"""

FOLLOW-UP ROUND - this is the strongest signal you have.
After answering, the candidate was pushed on their own wording and replied under time
pressure with no chance to prepare:

  Follow-up asked : {followup.get("question")}
  They replied    : {followup.get("answer") or "(no answer)"}

Weigh this heavily. If they cannot defend, explain, or even engage with wording they
themselves used, treat the original answer it came from as very likely not their own
work and score that answer down hard, regardless of how polished it looked. If they
defend it coherently, that corroborates the original answer and it should score at
least as well as it otherwise would.
"""

    prompt = f"""You are a hackathon judge scoring a developer's answers about a
project they claim to have built.

Score whether the answer shows real understanding of the problem being solved, the
logic of how it works, the reasoning behind the stack, or how the thing is actually
used. Judge the thinking, not the vocabulary.

Score WELL: a confident, correct explanation in the developer's own words, even with
no code, no function names, and no exact syntax. Paraphrasing is fine. Being informal
is fine.

Score POORLY: answers that are vague enough to describe any project, contradict how
the system actually works, dodge the question, or restate the question back.

Do NOT penalise an answer for failing to quote code, misremembering an exact name, or
using different terminology than the codebase, as long as the underlying reasoning is
right.

Return ONLY JSON, no prose:
{{"overall_score": 0-100, "breakdown": [{{"question": "...", "score": 0-10, "note": "..."}}]}}

{qa_pairs}
{followup_block}
"""
    response = await _model().generate_content_async(prompt)
    return json.loads(_strip_code_fence(response.text))


def _posting_block(draft: dict) -> str:
    stack = ", ".join(draft.get("tech_stack") or []) or "(none listed)"
    return f"""COMPANY: {draft.get("company_name", "")}
ROLE: {draft.get("role_title", "")}
TECH STACK LISTED: {stack}
DESCRIPTION:
{draft.get("description", "")}"""


async def generate_company_quiz_questions(draft: dict, n_questions: int = 5) -> list[dict]:
    """
    Interrogate a job posting the way the repo quiz interrogates a repo.

    Same engine, mirrored subject: instead of asking a developer whether they
    understand the code they submitted, this asks the poster whether they know the
    role they are advertising. A posting assembled from a template is exactly as
    cheap as a resume assembled from one, and fails here for the same reason - there
    is no lived detail behind it to produce under a clock.
    """
    prompt = f"""You are an experienced engineer who just read this job posting and is
deciding whether to apply. You get to ask the hiring manager {n_questions} questions
first.

Ask what someone who actually owns this role could answer instantly and someone who
pasted together a template could not. Push on vague recruiter language rather than
accepting it - if the posting says "fast-paced" or "rockstar" or lists ten
technologies, make them say what that concretely means here.

Cover these four categories, at least one question each:
  role    - what this person actually does day to day, and what "doing well" looks like in the first 90 days
  stack   - which of the listed technologies the hire actually touches, and why each one is in the stack
  team    - who they work with, who decides what they build, how big the team is
  reality - the unglamorous part: the constraints, the legacy, what makes this role genuinely hard, why the seat is open

Ground each question in something specific from the posting - a phrase they used, a
technology they listed, a claim they made. Do NOT ask about salary, benefits, or
interview logistics. Do NOT ask questions answerable by re-reading the posting aloud.

Return ONLY a JSON object, no prose:
{{"questions": [{{"question": "...", "category": "role" | "stack" | "team" | "reality"}}]}}

POSTING:
{_posting_block(draft)}
"""
    response = await _model().generate_content_async(prompt)
    return _parse_questions(json.loads(_strip_code_fence(response.text)))


async def grade_company_answers(
    draft: dict, questions: list[dict], answers: list[dict], followup: dict | None = None
) -> dict:
    """
    Score whether the posting reflects a role this person actually knows.

    The mirror of grade_answers: there, a candidate's claim is their code; here it is
    their posting. The failure being caught is the same one - a confident description
    of something the author has no real contact with.
    """
    qa_pairs = "\n\n".join(
        "Q: {q}\nA: {a}".format(
            q=q["question"],
            a=next((a["answer"] for a in answers if a["question_id"] == q["id"]), "(no answer)"),
        )
        for q in questions
    )

    followup_block = ""
    if followup and followup.get("question"):
        followup_block = f"""

FOLLOW-UP ROUND - this is the strongest signal you have.
After answering, they were pushed on their own wording and replied under time pressure
with no chance to prepare:

  Follow-up asked : {followup.get("question")}
  They replied    : {followup.get("answer") or "(no answer)"}

Weigh this heavily. If they cannot defend or even engage with wording they themselves
used, treat the original answer it came from as very likely not describing a role they
know, and score that answer down hard regardless of how polished it looked.
"""

    prompt = f"""You are scoring a hiring manager on whether the job posting below
reflects a role they actually know, rather than a template they assembled.

Score WELL: concrete, specific answers - named systems, real trade-offs, honest
constraints, an admission that part of the job is tedious or unresolved. Someone
describing a real seat on a real team says things that could not be said about any
other job.

Score POORLY: answers that would fit any company hiring any engineer, buzzwords with
nothing under them, restating the posting back, or dodging the question. Also score
down when an answer contradicts the posting - a listed technology nobody touches, or
a scope that turns out to be far smaller or larger than advertised - because the
posting failing to match the role is exactly the thing being tested.

Do NOT reward polish, length, or enthusiasm. Do NOT penalise blunt or unflattering
honesty about the role; that is evidence they know it.

Return ONLY JSON, no prose:
{{"overall_score": 0-100, "breakdown": [{{"question": "...", "score": 0-10, "note": "..."}}]}}

THE POSTING THEY WROTE:
{_posting_block(draft)}

THEIR ANSWERS:
{qa_pairs}
{followup_block}
"""
    response = await _model().generate_content_async(prompt)
    return json.loads(_strip_code_fence(response.text))
