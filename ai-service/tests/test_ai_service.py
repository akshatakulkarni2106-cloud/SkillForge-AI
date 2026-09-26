import json
import os

os.environ.setdefault("AI_PROVIDER", "groq")
os.environ.setdefault("GROQ_API_KEY", "gsk_test_key_1234567890")
os.environ.setdefault("GROQ_MODEL", "llama-3.1-8b-instant")
os.environ.setdefault("BACKEND_ORIGIN", "http://localhost:5000")

import pytest
from fastapi.testclient import TestClient

import llm
from app.main import app


@pytest.fixture
def sample_question_payload():
    return {
        "question": "Which JavaScript keyword declares a block-scoped variable?",
        "options": ["var", "let", "define", "static"],
        "correct_index": 1,
        "explanation": "let is block-scoped and avoids hoisting issues in function or block scopes.",
        "topic": "Variables & scope",
        "difficulty": "easy",
    }


def make_sequence(*responses):
    responses = list(responses)

    def _fake_call(*_args, **_kwargs):
        if not responses:
            raise AssertionError("No more mocked LLM responses available")
        return responses.pop(0)

    return _fake_call


def test_valid_json_accepted(monkeypatch, sample_question_payload):
    sequence = [
        json.dumps(sample_question_payload),
        json.dumps({"solved_index": 1}),
    ]
    monkeypatch.setattr(llm, "_call_chat_completion", make_sequence(*sequence))
    result = llm.generate_question("JavaScript", "easy", ["Which variable keyword is used for block scope?"], {"recent_results": [True, False]})

    assert result["correct_index"] == 1
    assert result["options"][1] == "let"


def test_invalid_json_retried_then_502(monkeypatch):
    monkeypatch.setattr(llm, "_call_chat_completion", make_sequence("oops", "still bad", "still bad"))
    client = TestClient(app)

    response = client.post(
        "/generate-question",
        json={
            "skill": "JavaScript",
            "difficulty": "easy",
            "already_asked": ["An old question"],
            "performance": {"recent_results": [True, False]},
        },
    )

    assert response.status_code == 502
    assert "valid JSON" in response.json()["detail"] or "LLM response" in response.json()["detail"]


def test_valid_generated_payload_is_accepted_without_second_verification(monkeypatch, sample_question_payload):
    payload = {**sample_question_payload, "correct_index": 0}
    calls = {"count": 0}

    def fake_call(*_args, **_kwargs):
        calls["count"] += 1
        return json.dumps(payload)

    monkeypatch.setattr(llm, "_call_chat_completion", fake_call)

    result = llm.generate_question("JavaScript", "easy", [], {"recent_results": [True, False]})

    assert result["correct_index"] == 0
    assert calls["count"] == 1


def test_duplicate_of_asked_rejected(monkeypatch, sample_question_payload):
    duplicate_question = {**sample_question_payload, "question": "A duplicate question already used"}
    sequence = [
        json.dumps(duplicate_question),
        json.dumps(duplicate_question),
        json.dumps(duplicate_question),
    ]
    monkeypatch.setattr(llm, "_call_chat_completion", make_sequence(*sequence))

    with pytest.raises(RuntimeError, match="duplicate"):
        llm.generate_question("JavaScript", "easy", ["A duplicate question already used"], {"recent_results": [True, False]})
