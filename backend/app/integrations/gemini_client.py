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

    prompt = f"""You are interviewing a developer about their own codebase.
Given these files from their GitHub repo, write {n_questions} short, specific
questions that reference exact function names, variable names, or line-level
decisions in this code. Avoid generic questions like "what does this project do".

Return ONLY a JSON array, no prose:
[{{"question": "...", "file_reference": "path/to/file.py"}}]

CODE:
{file_context}
"""
    response = _model().generate_content(prompt)
    return json.loads(_strip_code_fence(response.text))


async def grade_answers(questions: list[dict], answers: list[dict]) -> dict:
    qa_pairs = "\n\n".join(
        "Q: {q}\nA: {a}".format(
            q=q["question"],
            a=next((a["answer"] for a in answers if a["question_id"] == q["id"]), "(no answer)"),
        )
        for q in questions
    )

    prompt = f"""Grade these answers about the candidate's own codebase.
Judge whether each answer shows real understanding (specific, correct,
references actual logic) versus a vague answer that could apply to any project.

Return ONLY JSON, no prose:
{{"overall_score": 0-100, "breakdown": [{{"question": "...", "score": 0-10, "note": "..."}}]}}

{qa_pairs}
"""
    response = _model().generate_content(prompt)
    return json.loads(_strip_code_fence(response.text))
