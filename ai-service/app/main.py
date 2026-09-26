import asyncio
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from llm import GenerateQuestionRequest, Settings, evaluate_assessment, generate_question, settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillforge.ai")

app = FastAPI(title="SkillForge AI service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.backend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def validate_llm_settings() -> None:
    try:
        settings.validate()
        if settings.is_configured:
            logger.info("AI service startup OK. Provider=%s model=%s", settings.provider, settings.model)
        else:
            logger.warning("AI service started without a valid GROQ_API_KEY. Requests will fail until a real Groq key is configured.")
    except RuntimeError as exc:
        logger.warning("AI service startup warning: %s", exc)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "provider": "groq", "model": settings.model, "key_configured": settings.is_configured}


@app.post("/generate-question")
async def generate_question_endpoint(payload: GenerateQuestionRequest):
    try:
        result = await asyncio.to_thread(
            generate_question,
            payload.skill,
            payload.difficulty,
            payload.already_asked,
            payload.performance,
        )
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/evaluate")
async def evaluate_endpoint(payload: list[dict]):
    try:
        result = await asyncio.to_thread(evaluate_assessment, payload)
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
