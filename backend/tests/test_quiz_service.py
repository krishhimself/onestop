"""
Service orchestration and suspect selection.

Suspect selection decides who gets interrogated, so it is the part of the
anti-gaming work that actually has teeth — a wrong pick means the pasted answer
goes unchallenged.
"""
from unittest.mock import AsyncMock

import pytest

from app.services import quiz_service
from app.services.quiz_service import pick_suspect_answer


def answer(qid, text="typed", seconds_left=None, flagged=False, delta=0):
    return {"question_id": qid, "answer": text, "seconds_left": seconds_left,
            "flagged_paste": flagged, "paste_delta": delta}


# --- suspect selection -----------------------------------------------------

def test_recorded_paste_beats_the_timing_heuristic():
    """A flag is evidence; typing pace is only an inference."""
    picked = pick_suspect_answer([
        answer("fast", "x" * 900, seconds_left=70),          # very suspicious timing
        answer("pasted", "y" * 300, seconds_left=5, flagged=True, delta=300),
    ])
    assert picked["question_id"] == "pasted"


def test_largest_injection_wins_among_flagged():
    picked = pick_suspect_answer([
        answer("small", "a" * 100, flagged=True, delta=60),
        answer("big", "b" * 500, flagged=True, delta=480),
        answer("mid", "c" * 200, flagged=True, delta=150),
    ])
    assert picked["question_id"] == "big"


def test_falls_back_to_fast_and_long_when_nothing_flagged():
    picked = pick_suspect_answer([
        answer("slow", "a" * 80, seconds_left=3),
        answer("fast", "b" * 800, seconds_left=66),
    ])
    assert picked["question_id"] == "fast"


def test_fast_one_liner_does_not_outrank_a_fast_essay():
    """Rate alone would pick the one-liner; weighting by length must not."""
    picked = pick_suspect_answer([
        answer("oneliner", "yes", seconds_left=74),
        answer("essay", "y" * 600, seconds_left=50),
    ])
    assert picked["question_id"] == "essay"


def test_blank_answers_are_never_selected_even_when_flagged():
    picked = pick_suspect_answer([
        answer("blank", "", flagged=True, delta=900),
        answer("real", "typed out", seconds_left=4),
    ])
    assert picked["question_id"] == "real"


def test_no_timing_data_still_selects_something():
    """The follow-up round must happen even with no telemetry at all."""
    picked = pick_suspect_answer([answer("a", "first"), answer("b", "second")])
    assert picked["question_id"] == "a"


def test_all_blank_returns_first_so_the_round_still_runs():
    picked = pick_suspect_answer([answer("a", ""), answer("b", "   ")])
    assert picked["question_id"] == "a"


def test_no_answers_returns_none():
    assert pick_suspect_answer([]) is None


# --- create_quiz -----------------------------------------------------------

async def test_create_quiz_persists_complexity_and_assigns_ids(monkeypatch, complexity):
    monkeypatch.setattr(quiz_service.github_client, "fetch_repo_files",
                        AsyncMock(return_value=[{"path": "a.py", "content": "x"}]))
    monkeypatch.setattr(quiz_service.gemini_client, "generate_quiz_questions",
                        AsyncMock(return_value=([{"question": "q", "category": "logic"}], complexity)))
    saved = AsyncMock()
    monkeypatch.setattr(quiz_service.quiz_repository, "save_attempt", saved)

    result = await quiz_service.create_quiz("https://github.com/o/r", "u1")

    assert result["complexity"] == complexity
    assert result["time_limit_seconds"] == 75
    assert result["questions"][0]["id"], "questions must be given ids"
    doc = saved.call_args.args[0]
    assert doc["complexity"] == complexity
    assert doc["status"] == "generated"


async def test_create_quiz_rejects_a_repo_with_no_source(monkeypatch):
    monkeypatch.setattr(quiz_service.github_client, "fetch_repo_files", AsyncMock(return_value=[]))
    with pytest.raises(ValueError):
        await quiz_service.create_quiz("https://github.com/o/r", None)


# --- follow-up round -------------------------------------------------------

async def test_start_followup_targets_the_flagged_answer(monkeypatch, attempt):
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    gen = AsyncMock(return_value="You said X — what if Y throws?")
    monkeypatch.setattr(quiz_service.gemini_client, "generate_followup_question", gen)
    monkeypatch.setattr(quiz_service.quiz_repository, "update_followup", AsyncMock())

    out = await quiz_service.start_followup("quiz-1", attempt["answers"], "u1")

    assert out["followup"]["targets_question_id"] == "q2"
    # the pasted answer's text is what the model was asked to push on
    assert gen.call_args.args[1] == attempt["answers"][1]["answer"]


async def test_start_followup_does_not_grade(monkeypatch, attempt):
    """Grading here would let a candidate bank a score and skip the round."""
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    monkeypatch.setattr(quiz_service.gemini_client, "generate_followup_question", AsyncMock(return_value="q?"))
    monkeypatch.setattr(quiz_service.quiz_repository, "update_followup", AsyncMock())
    graded = AsyncMock()
    monkeypatch.setattr(quiz_service.gemini_client, "grade_answers", graded)

    out = await quiz_service.start_followup("quiz-1", attempt["answers"], "u1")

    graded.assert_not_called()
    assert "score" not in out


async def test_start_followup_unknown_quiz(monkeypatch):
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=None))
    with pytest.raises(LookupError):
        await quiz_service.start_followup("nope", [answer("q1")], "u1")


# --- final grading ---------------------------------------------------------

async def test_grade_quiz_passes_the_followup_defence_to_the_grader(monkeypatch, attempt):
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    grade = AsyncMock(return_value={"overall_score": 88, "breakdown": []})
    monkeypatch.setattr(quiz_service.gemini_client, "grade_answers", grade)
    monkeypatch.setattr(quiz_service.quiz_repository, "update_result", AsyncMock())

    result = await quiz_service.grade_quiz("quiz-1", "my defence", "u1", seconds_left=9.0)

    assert result["overall_score"] == 88
    sent = grade.call_args.kwargs["followup"]
    assert sent["answer"] == "my defence"
    assert sent["targets_question_id"] == "q2"


async def test_grade_quiz_unknown_quiz(monkeypatch):
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=None))
    with pytest.raises(LookupError):
        await quiz_service.grade_quiz("nope", "answer", "u1")


# --- ownership ------------------------------------------------------------


async def test_start_followup_refuses_another_users_quiz(monkeypatch, attempt):
    """The quiz exists and the caller is authenticated — but it is not theirs."""
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    gen = AsyncMock()
    monkeypatch.setattr(quiz_service.gemini_client, "generate_followup_question", gen)

    with pytest.raises(LookupError):
        await quiz_service.start_followup("quiz-1", attempt["answers"], "someone-else")
    gen.assert_not_called(), "must refuse before spending an API call"


async def test_grade_quiz_refuses_another_users_quiz(monkeypatch, attempt):
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    grade = AsyncMock()
    monkeypatch.setattr(quiz_service.gemini_client, "grade_answers", grade)

    with pytest.raises(LookupError):
        await quiz_service.grade_quiz("quiz-1", "defence", "someone-else")
    grade.assert_not_called()


async def test_a_missing_quiz_and_someone_elses_are_indistinguishable(monkeypatch, attempt):
    """Both raise LookupError, so the endpoint answers 404 either way."""
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=None))
    with pytest.raises(LookupError) as missing:
        await quiz_service.grade_quiz("nope", "d", "u1")

    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    with pytest.raises(LookupError) as foreign:
        await quiz_service.grade_quiz("quiz-1", "d", "someone-else")

    assert str(missing.value) == str(foreign.value)


async def test_unattributed_attempts_are_unreachable(monkeypatch, attempt):
    """Attempts predating auth have no owner and prove nothing about anyone."""
    attempt["user_id"] = None
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    with pytest.raises(LookupError):
        await quiz_service.grade_quiz("quiz-1", "d", "u1")


async def test_owner_still_gets_through(monkeypatch, attempt):
    monkeypatch.setattr(quiz_service.quiz_repository, "get_attempt", AsyncMock(return_value=attempt))
    monkeypatch.setattr(quiz_service.gemini_client, "grade_answers",
                        AsyncMock(return_value={"overall_score": 70, "breakdown": []}))
    monkeypatch.setattr(quiz_service.quiz_repository, "update_result", AsyncMock())

    result = await quiz_service.grade_quiz("quiz-1", "defence", "u1")
    assert result["overall_score"] == 70
