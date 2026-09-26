import json
import logging
import os
import time
from typing import Any, Literal

from dotenv import load_dotenv
from groq import APIConnectionError, APIStatusError, Groq, RateLimitError
from pydantic import BaseModel, Field, ValidationError, field_validator

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logger = logging.getLogger("skillforge.ai")


class Settings:
    def __init__(self) -> None:
        self.provider = (os.getenv("AI_PROVIDER") or "groq").lower()
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model = os.getenv("GROQ_MODEL") or "llama-3.1-8b-instant"
        self.backend_origin = os.getenv("BACKEND_ORIGIN") or "http://localhost:5000"

    def validate(self) -> None:
        if self.provider != "groq":
            raise RuntimeError(f"Unsupported AI provider '{self.provider}'. Set AI_PROVIDER=groq in ai-service/.env.")

    @property
    def is_configured(self) -> bool:
        if not self.api_key:
            return False

        candidate = self.api_key.strip()
        if not candidate:
            return False
        if not candidate.startswith("gsk_"):
            return False
        if len(candidate) <= 20:
            return False

        lowered = candidate.lower()
        blocked_words = ("placeholder", "your_key_here", "your_groq_api_key_here", "changeme")
        if any(word in lowered for word in blocked_words):
            return False

        return True


settings = Settings()


class GenerateQuestionRequest(BaseModel):
    skill: str = Field(..., min_length=1)
    difficulty: Literal["easy", "medium", "hard"]
    already_asked: list[str] = Field(default_factory=list)
    performance: dict[str, Any] | None = None


class GeneratedQuestion(BaseModel):
    question: str = Field(..., min_length=10)
    options: list[str] = Field(..., min_length=4, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    explanation: str = Field(..., min_length=10)
    topic: str = Field(..., min_length=2)
    difficulty: Literal["easy", "medium", "hard"]

    @field_validator("question", "explanation", "topic")
    @classmethod
    def strip_blank_fields(cls, value: str) -> str:
        cleaned = str(value).strip()
        if not cleaned:
            raise ValueError("Value cannot be empty")
        return cleaned

    @field_validator("options")
    @classmethod
    def validate_options(cls, value: list[str]) -> list[str]:
        if len(value) != 4:
            raise ValueError("Exactly 4 options are required")
        cleaned = [str(item).strip() for item in value]
        if any(not item for item in cleaned):
            raise ValueError("Options cannot be empty")
        if len(set(cleaned)) != 4:
            raise ValueError("Options must be unique")
        return cleaned


class EvaluationItem(BaseModel):
    question: str = Field(..., min_length=10)
    options: list[str] = Field(..., min_length=4, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    user_index: int = Field(..., ge=0, le=3)
    topic: str = Field(..., min_length=2)


class EvaluationResult(BaseModel):
    score_summary: dict[str, Any]
    strengths: list[str]
    weak_topics: list[str]
    per_wrong_answer: list[dict[str, Any]]
    improvement_plan: list[str]


def normalize_text(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def get_groq_client() -> Groq:
    settings.validate()
    if not settings.is_configured:
        raise RuntimeError("GROQ_API_KEY is missing or invalid. Add your Groq API key to ai-service/.env and restart the AI service.")
    return Groq(api_key=settings.api_key, timeout=15.0, max_retries=0)


def _parse_json_payload(raw_response: str) -> dict[str, Any]:
    candidate = raw_response.strip()
    if candidate.startswith("```"):
        candidate = candidate.strip("`")
        if "json" in candidate.lower():
            candidate = candidate.split("json", 1)[1].strip()
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM response was not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError("LLM response must be a JSON object")
    return parsed


def _call_chat_completion(system_prompt: str, user_prompt: str) -> str:
    client = get_groq_client()
    response = client.chat.completions.create(
        model=settings.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
        max_tokens=800,
    )
    usage = getattr(response, "usage", None)
    if usage is not None:
        logger.info("Groq token usage: %s", getattr(usage, "model_dump", lambda: usage)())
    return response.choices[0].message.content or "{}"


def _retry_on_llm_error(fn, *args, **kwargs):
    attempts = 2
    for attempt in range(1, attempts + 1):
        try:
            return fn(*args, **kwargs)
        except APIStatusError as exc:
            status = getattr(exc, "status_code", None)
            if status == 400:
                raise ValueError(f"Groq rejected the request as invalid JSON: {exc}") from exc
            if status in (429, 500, 502, 503, 504):
                if attempt == attempts:
                    raise RuntimeError(f"LLM request failed after {attempts} attempts: {exc}") from exc
                delay = 1
                logger.warning("LLM HTTP %s on attempt %s/%s. Retrying in %ss.", status, attempt, attempts, delay)
                time.sleep(delay)
                continue
            raise
        except (APIConnectionError, RateLimitError, TimeoutError, OSError) as exc:
            if attempt == attempts:
                raise RuntimeError(f"LLM request failed after {attempts} attempts: {exc}") from exc
            delay = 1
            logger.warning("LLM network error on attempt %s/%s. Retrying in %ss.", attempt, attempts, delay)
            time.sleep(delay)


def generate_question(skill: str, difficulty: str, already_asked: list[str] | None = None, performance: dict[str, Any] | None = None) -> dict[str, Any]:
    already_asked = already_asked or []
    cleaned_asked = [item for item in already_asked if isinstance(item, str) and item.strip()]
    performance_summary = performance or {}
    recent_results = performance_summary.get("recent_results") or performance_summary.get("history") or []

    system_prompt = (
        "You are a high-quality skill assessment generator. Return only a single valid JSON object with exactly these keys: "
        "question, options, correct_index, explanation, topic, difficulty. "
        "Respond with ONLY the raw JSON object. No markdown, no fenced code blocks, no extra text, no reasoning. "
        "If the question includes a code snippet, keep it SHORT (under 3 lines), do not use triple backticks, and escape all quotes and apostrophes correctly inside the JSON string. "
        "Prefer a plain-English description of the code behavior instead of embedding a code block when possible."
    )
    user_prompt = (
        f"Generate one novel multiple-choice question for skill '{skill}' at difficulty '{difficulty}'.\n"
        f"Do not repeat or paraphrase any of the following already asked questions:\n{json.dumps(cleaned_asked, ensure_ascii=False)}\n"
        f"Student performance summary: {json.dumps(performance_summary, ensure_ascii=False)}\n"
        "Requirements:\n"
        "- Output only a JSON object with exactly these keys in this order: question, options, correct_index, explanation, topic, difficulty\n"
        "- options must be an array of exactly 4 distinct strings\n"
        "- correct_index must be an integer from 0 to 3\n"
        "- explanation must explain why the correct answer is right\n"
        "- topic should be a concise topic name for the skill\n"
        "- difficulty must be 'easy', 'medium', or 'hard'\n"
        "- The question must be fresh and must not repeat or paraphrase anything in already_asked."
    )

    for attempt in range(1, 2 + 1):
        try:
            raw = _retry_on_llm_error(_call_chat_completion, system_prompt, user_prompt)
            payload = _parse_json_payload(raw)
            question = GeneratedQuestion.model_validate(payload)
            if any(normalize_text(candidate) == normalize_text(question.question) for candidate in cleaned_asked):
                raise ValueError("Generated question duplicates an already asked question")
            return question.model_dump()
        except ValidationError as exc:
            logger.warning("Invalid generated question payload on attempt %s/%s: %s", attempt, 2, exc)
            if attempt == 2:
                raise RuntimeError("AI question generation failed validation after 2 attempts") from exc
            time.sleep(1)
        except ValueError as exc:
            logger.warning("Question rejected on attempt %s/%s: %s", attempt, 2, exc)
            if str(exc).startswith("Groq rejected the request as invalid JSON:"):
                raise
            if attempt == 2:
                raise RuntimeError(str(exc)) from exc
            time.sleep(1)
        except RuntimeError as exc:
            logger.warning("LLM generation runtime failure on attempt %s/%s: %s", attempt, 2, exc)
            if attempt == 2:
                raise
            time.sleep(1)

    raise RuntimeError("AI question generation failed after retries")


def evaluate_assessment(items: list[dict[str, Any]]) -> dict[str, Any]:
    system_prompt = (
        "You are an expert skills coach. Return only valid JSON with the exact required schema. "
        "Do not add markdown fences or outside text."
    )
    user_prompt = (
        "Evaluate the user's answers to the assessment below.\n"
        f"Assessment data: {json.dumps(items, ensure_ascii=False)}\n"
        "Return only JSON with this schema:\n"
        "{\n"
        "  'score_summary': {'total_questions': 0, 'correct_answers': 0, 'score_percent': 0},\n"
        "  'strengths': ['...'],\n"
        "  'weak_topics': ['...'],\n"
        "  'per_wrong_answer': [{'question': '...', 'topic': '...', 'correct_answer': '...', 'user_answer': '...', 'explanation': '...'}],\n"
        "  'improvement_plan': ['...', '...']\n"
        "}\n"
        "If all answers are correct, still return a positive feedback summary and a short improvement plan."
    )
    raw = _retry_on_llm_error(_call_chat_completion, system_prompt, user_prompt)
    payload = _parse_json_payload(raw)
    result = EvaluationResult.model_validate(payload)
    return result.model_dump()
