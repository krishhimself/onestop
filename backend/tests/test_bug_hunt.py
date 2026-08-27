"""
Tests for Bug Hunt mode in the repository quiz.

Verifies:
1. Gemini generates subtle modified files and stores ground-truth bugs server-side.
2. The generated client payload NEVER leaks the injected bugs list (no answer key leak).
3. Candidate findings are evaluated and graded server-side against the secret injected bugs.
4. Cross-user isolation: attempts cannot be submitted or viewed by other users.
"""
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app
from app.services import bug_hunt_service

client = TestClient(app)

CANDIDATE_TOKEN = create_access_token("user_candidate_1", "candidate")
OTHER_TOKEN = create_access_token("user_candidate_2", "candidate")

AUTH_HEADERS = {"Authorization": f"Bearer {CANDIDATE_TOKEN}"}
OTHER_AUTH_HEADERS = {"Authorization": f"Bearer {OTHER_TOKEN}"}

SAMPLE_REPO_URL = "https://github.com/test/sample-repo"

MOCK_SOURCE_FILES = [
    {
        "path": "app/calculator.py",
        "content": "def calculate_total(items):\n    return sum(item.price for item in items)",
    }
]

MOCK_MODIFIED_FILES = [
    {
        "path": "app/calculator.py",
        "content": "def calculate_total(items):\n    # subtle bug injected: excluding last item\n    return sum(item.price for item in items[:-1])",
    }
]

MOCK_INJECTED_BUGS = [
    {
        "id": "bug_1",
        "file_path": "app/calculator.py",
        "line_hint": "line 3 in calculate_total",
        "bug_type": "off_by_one",
        "description": "Slice items[:-1] ignores the last element in items",
        "impact": "Cart total calculation will be missing the last item's price",
    }
]

MOCK_GRADE_RESULT = {
    "score": 90.0,
    "bugs_caught": 1,
    "total_bugs": 1,
    "breakdown": [
        {
            "bug_id": "bug_1",
            "file_path": "app/calculator.py",
            "description": "Slice items[:-1] ignores the last element",
            "caught": True,
            "explanation_quality": "excellent",
            "feedback": "Correctly identified that items[:-1] slices off the final item.",
        }
    ],
    "summary": "Candidate demonstrated strong comprehension by pinpointing the slicing off-by-one bug.",
}


@pytest.mark.asyncio
async def test_generate_bughunt_does_not_leak_injected_bugs(monkeypatch):
    """
    CRITICAL SECURITY INVARIANT:
    The response from /quiz/bughunt/generate MUST NOT contain 'injected_bugs' or any
    form of answer key. The ground truth must reside exclusively on the server.
    """
    monkeypatch.setattr(
        "app.integrations.github_client.fetch_repo_files",
        AsyncMock(return_value=MOCK_SOURCE_FILES),
    )
    monkeypatch.setattr(
        "app.integrations.gemini_client.generate_bug_hunt",
        AsyncMock(return_value=(MOCK_MODIFIED_FILES, MOCK_INJECTED_BUGS)),
    )

    response = client.post(
        "/api/v1/quiz/bughunt/generate",
        json={"repo_url": SAMPLE_REPO_URL},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()

    assert "bug_hunt_id" in data
    assert "modified_files" in data
    assert data["expected_bug_count"] == 1
    assert data["time_limit_seconds"] == 180

    # Answer key must NEVER be in client response
    assert "injected_bugs" not in data
    assert "bugs" not in data
    assert "ground_truth" not in data
    assert "answer_key" not in data


@pytest.mark.asyncio
async def test_submit_and_grade_bughunt(monkeypatch):
    """
    Submitting findings evaluates them against server-side injected bugs and marks
    the attempt completed.
    """
    monkeypatch.setattr(
        "app.integrations.github_client.fetch_repo_files",
        AsyncMock(return_value=MOCK_SOURCE_FILES),
    )
    monkeypatch.setattr(
        "app.integrations.gemini_client.generate_bug_hunt",
        AsyncMock(return_value=(MOCK_MODIFIED_FILES, MOCK_INJECTED_BUGS)),
    )
    monkeypatch.setattr(
        "app.integrations.gemini_client.grade_bug_hunt",
        AsyncMock(return_value=MOCK_GRADE_RESULT),
    )

    # 1. Generate Bug Hunt
    gen_res = client.post(
        "/api/v1/quiz/bughunt/generate",
        json={"repo_url": SAMPLE_REPO_URL},
        headers=AUTH_HEADERS,
    )
    bug_hunt_id = gen_res.json()["bug_hunt_id"]

    # 2. Submit findings
    findings = [
        {
            "file_path": "app/calculator.py",
            "suspected_location": "line 3 in calculate_total",
            "description": "items[:-1] slices off the last item so the total calculation ignores it.",
            "seconds_left": 120.0,
            "flagged_paste": False,
            "paste_delta": 0,
        }
    ]

    sub_res = client.post(
        "/api/v1/quiz/bughunt/submit",
        json={"bug_hunt_id": bug_hunt_id, "findings": findings},
        headers=AUTH_HEADERS,
    )

    assert sub_res.status_code == 200
    res_data = sub_res.json()
    assert res_data["score"] == 90.0
    assert res_data["bugs_caught"] == 1
    assert res_data["total_bugs"] == 1
    assert len(res_data["breakdown"]) == 1
    assert res_data["breakdown"][0]["caught"] is True


@pytest.mark.asyncio
async def test_bughunt_cross_user_isolation(monkeypatch):
    """
    Another user cannot submit findings for a bug hunt attempt they do not own.
    """
    monkeypatch.setattr(
        "app.integrations.github_client.fetch_repo_files",
        AsyncMock(return_value=MOCK_SOURCE_FILES),
    )
    monkeypatch.setattr(
        "app.integrations.gemini_client.generate_bug_hunt",
        AsyncMock(return_value=(MOCK_MODIFIED_FILES, MOCK_INJECTED_BUGS)),
    )

    gen_res = client.post(
        "/api/v1/quiz/bughunt/generate",
        json={"repo_url": SAMPLE_REPO_URL},
        headers=AUTH_HEADERS,
    )
    bug_hunt_id = gen_res.json()["bug_hunt_id"]

    # Other user attempts submission -> 404
    sub_res = client.post(
        "/api/v1/quiz/bughunt/submit",
        json={"bug_hunt_id": bug_hunt_id, "findings": []},
        headers=OTHER_AUTH_HEADERS,
    )
    assert sub_res.status_code == 404


@pytest.mark.asyncio
async def test_bughunt_empty_repo_error(monkeypatch):
    """
    Generating bug hunt for a repo with no source files raises 400.
    """
    monkeypatch.setattr(
        "app.integrations.github_client.fetch_repo_files",
        AsyncMock(return_value=[]),
    )

    response = client.post(
        "/api/v1/quiz/bughunt/generate",
        json={"repo_url": "https://github.com/empty/empty-repo"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_bughunt_attempt_saved_with_bughunt_type(monkeypatch):
    """
    Verifies that the attempt is stored in the repository with type: 'bughunt'.
    """
    from app.repositories import quiz_repository

    monkeypatch.setattr(
        "app.integrations.github_client.fetch_repo_files",
        AsyncMock(return_value=MOCK_SOURCE_FILES),
    )
    monkeypatch.setattr(
        "app.integrations.gemini_client.generate_bug_hunt",
        AsyncMock(return_value=(MOCK_MODIFIED_FILES, MOCK_INJECTED_BUGS)),
    )

    gen_res = client.post(
        "/api/v1/quiz/bughunt/generate",
        json={"repo_url": SAMPLE_REPO_URL},
        headers=AUTH_HEADERS,
    )
    assert gen_res.status_code == 200
    bug_hunt_id = gen_res.json()["bug_hunt_id"]

    attempt = await quiz_repository.get_attempt(bug_hunt_id)
    assert attempt is not None
    assert attempt["type"] == "bughunt"
    assert attempt["repo_url"] == SAMPLE_REPO_URL
    assert attempt["user_id"] == "user_candidate_1"
    assert attempt["status"] == "generated"
    assert len(attempt["injected_bugs"]) == 1
    assert attempt["injected_bugs"][0]["id"] == "bug_1"


@pytest.mark.asyncio
async def test_bughunt_grading_distinguishes_catches_and_misses(monkeypatch):
    """
    Verifies that grading evaluates catches vs misses accurately when some bugs are missed.
    """
    multi_bugs = [
        {
            "id": "bug_1",
            "file_path": "app/calculator.py",
            "line_hint": "line 3 in calculate_total",
            "bug_type": "off_by_one",
            "description": "Slice items[:-1] ignores the last element in items",
            "impact": "Cart total missing last item",
        },
        {
            "id": "bug_2",
            "file_path": "app/auth.py",
            "line_hint": "line 12 in check_permission",
            "bug_type": "inverted_condition",
            "description": "Condition inverted: if is_admin allows unauthorized users",
            "impact": "Security bypass for non-admins",
        },
    ]

    partial_grade_result = {
        "score": 50.0,
        "bugs_caught": 1,
        "total_bugs": 2,
        "breakdown": [
            {
                "bug_id": "bug_1",
                "file_path": "app/calculator.py",
                "description": "Slice items[:-1] ignores the last element",
                "caught": True,
                "explanation_quality": "good",
                "feedback": "Spotted the slicing off-by-one error.",
            },
            {
                "bug_id": "bug_2",
                "file_path": "app/auth.py",
                "description": "Condition inverted in auth check",
                "caught": False,
                "explanation_quality": "missed",
                "feedback": "Candidate did not identify the inverted condition in auth check.",
            },
        ],
        "summary": "Candidate caught the arithmetic off-by-one bug but missed the authorization logic defect.",
    }

    monkeypatch.setattr(
        "app.integrations.github_client.fetch_repo_files",
        AsyncMock(return_value=MOCK_SOURCE_FILES),
    )
    monkeypatch.setattr(
        "app.integrations.gemini_client.generate_bug_hunt",
        AsyncMock(return_value=(MOCK_MODIFIED_FILES, multi_bugs)),
    )
    monkeypatch.setattr(
        "app.integrations.gemini_client.grade_bug_hunt",
        AsyncMock(return_value=partial_grade_result),
    )

    gen_res = client.post(
        "/api/v1/quiz/bughunt/generate",
        json={"repo_url": SAMPLE_REPO_URL},
        headers=AUTH_HEADERS,
    )
    bug_hunt_id = gen_res.json()["bug_hunt_id"]

    sub_res = client.post(
        "/api/v1/quiz/bughunt/submit",
        json={
            "bug_hunt_id": bug_hunt_id,
            "findings": [
                {
                    "file_path": "app/calculator.py",
                    "suspected_location": "calculate_total",
                    "description": "The slice leaves out the last item.",
                }
            ],
        },
        headers=AUTH_HEADERS,
    )

    assert sub_res.status_code == 200
    res = sub_res.json()
    assert res["score"] == 50.0
    assert res["bugs_caught"] == 1
    assert res["total_bugs"] == 2
    assert res["breakdown"][0]["caught"] is True
    assert res["breakdown"][1]["caught"] is False
    assert res["breakdown"][1]["explanation_quality"] == "missed"

