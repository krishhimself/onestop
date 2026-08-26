"""
Parsing of the model's response.

These cover the degradation paths rather than the prompt text. `complexity` is a
required field on QuizGenerateResponse, so a single malformed reply that reached
the schema unparsed would be a ValidationError and a 500 for the candidate.
"""
import json

import pytest

from app.integrations.gemini_client import (
    UNKNOWN_COMPLEXITY,
    _parse_quiz_payload,
    _strip_code_fence,
)


def test_well_formed_object():
    questions, complexity = _parse_quiz_payload(json.dumps({
        "questions": [{"question": "q", "category": "logic"}],
        "complexity": {"tier": "complex", "reasoning": "many parts"},
    }))
    assert len(questions) == 1
    assert complexity == {"tier": "complex", "reasoning": "many parts"}


def test_bare_array_still_yields_questions():
    """The model ignoring the object wrapper must not lose the quiz."""
    questions, complexity = _parse_quiz_payload(json.dumps([{"question": "q"}]))
    assert len(questions) == 1
    assert complexity["tier"] == "unknown"


@pytest.mark.parametrize("payload", [
    {"questions": [{"question": "q"}]},                      # complexity absent
    {"questions": [{"question": "q"}], "complexity": "hard"},  # not a dict
    {"questions": [{"question": "q"}], "complexity": None},
])
def test_unusable_complexity_degrades_but_keeps_questions(payload):
    questions, complexity = _parse_quiz_payload(json.dumps(payload))
    assert len(questions) == 1
    assert complexity == UNKNOWN_COMPLEXITY


@pytest.mark.parametrize("given,expected", [
    ("complex", "complex"),
    ("Moderate", "moderate"),   # case is normalised
    ("  TRIVIAL  ", "trivial"), # whitespace is stripped
    ("extreme", "unknown"),     # invented tiers are not passed through
    ("", "unknown"),
])
def test_tier_normalisation(given, expected):
    _, complexity = _parse_quiz_payload(json.dumps({
        "questions": [], "complexity": {"tier": given, "reasoning": "r"},
    }))
    assert complexity["tier"] == expected


def test_missing_reasoning_gets_a_default():
    _, complexity = _parse_quiz_payload(json.dumps({
        "questions": [], "complexity": {"tier": "trivial"},
    }))
    assert complexity["tier"] == "trivial"
    assert complexity["reasoning"]


def test_missing_questions_key_yields_empty_list():
    questions, _ = _parse_quiz_payload(json.dumps({"complexity": {"tier": "trivial", "reasoning": "r"}}))
    assert questions == []


@pytest.mark.parametrize("raw,expected", [
    ('{"a": 1}', '{"a": 1}'),
    ('```json\n{"a": 1}\n```', '{"a": 1}'),
    ('```\n{"a": 1}\n```', '{"a": 1}'),
    ('  {"a": 1}  ', '{"a": 1}'),
])
def test_strip_code_fence(raw, expected):
    assert _strip_code_fence(raw) == expected


async def test_generate_day1_questions_returns_parsed_list(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock
    from app.integrations import gemini_client

    mock_resp = MagicMock()
    mock_resp.text = json.dumps({
        "questions": [
            {"question": "What is the purpose of router.py?", "file_reference": "router.py", "category": "orientation"},
            {"question": "Where would you add a new endpoint?", "file_reference": "endpoints/", "category": "navigation"},
        ]
    })
    mock_model = MagicMock()
    mock_model.generate_content_async = AsyncMock(return_value=mock_resp)
    monkeypatch.setattr(gemini_client, "_model", lambda: mock_model)

    questions = await gemini_client.generate_day1_questions([{"path": "router.py", "content": "..."}])
    assert len(questions) == 2
    assert questions[0]["category"] == "orientation"
    assert questions[1]["category"] == "navigation"
