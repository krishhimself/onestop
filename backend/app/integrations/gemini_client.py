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


async def generate_quiz_questions(files: list[dict], n_questions: int = 5) -> list[dict]:
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

Return ONLY a JSON array, no prose:
[{{"question": "...", "file_reference": "path/to/file.py", "category": "problem" | "logic" | "stack" | "usage"}}]

CODE:
{file_context}
"""
    response = await _model().generate_content_async(prompt)
    return json.loads(_strip_code_fence(response.text))


async def grade_answers(questions: list[dict], answers: list[dict]) -> dict:
    qa_pairs = "\n\n".join(
        "Q: {q}\nA: {a}".format(
            q=q["question"],
            a=next((a["answer"] for a in answers if a["question_id"] == q["id"]), "(no answer)"),
        )
        for q in questions
    )

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
"""
    response = await _model().generate_content_async(prompt)
    return json.loads(_strip_code_fence(response.text))
