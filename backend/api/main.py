"""
api/main.py
────────────
FastAPI app exposing 3 endpoints:

  POST /analyse          — kick off indexing job
  GET  /status/{repo_id} — poll job status
  POST /chat             — RAG query
"""
from __future__ import annotations

import os
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import re

from pipeline.indexer  import index_repo, IndexResult, IndexStatus

app = FastAPI(
    title       = "RepoChat API",
    description = "RAG-based GitHub repo analyser",
    version     = "0.1.0",
)

# ── CORS

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins     = allowed_origins,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


@app.middleware("http")
async def _ensure_cors_on_errors(request, call_next):
    """Ensure CORS headers are present even if a handler raises an exception.

    FastAPI/Starlette should add CORS via CORSMiddleware, but in some cases
    error responses can miss the header. This wrapper logs the traceback and
    attaches the appropriate `Access-Control-Allow-Origin` header when the
    request `Origin` is in `allowed_origins`.
    """
    from fastapi.responses import PlainTextResponse
    import traceback

    try:
        response = await call_next(request)
    except Exception as exc:  # pragma: no cover - runtime protection
        traceback.print_exc()
        response = PlainTextResponse(str(exc), status_code=500)

    origin = request.headers.get("origin")
    if origin and origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        if True:  # keep credentials allowed as configured above
            response.headers["Access-Control-Allow-Credentials"] = "true"

    return response


# ── In-memory job store (swap for Redis in production)

_jobs: dict[str, dict] = {}    # job_id → {status, result, error}



class AnalyseRequest(BaseModel):
    github_url:    str
    force_reindex: bool = False
    provider:      str = "openai"
    api_key:       str | None = None
    chat_model:    str | None = None
    embed_model:   str | None = None


class AnalyseResponse(BaseModel):
    job_id:  str
    repo_id: str
    message: str


def _run_index_job(
    job_id: str,
    github_url: str,
    force_reindex: bool,
    provider: str,
    api_key: str | None,
    chat_model: str | None,
    embed_model: str | None,
):
    """Background task — runs the full pipeline and updates job store."""
    _jobs[job_id]["status"] = IndexStatus.CLONING

    def on_progress(status: IndexStatus, msg: str):
        _jobs[job_id]["status"]  = status
        _jobs[job_id]["message"] = msg

    result: IndexResult = index_repo(
        github_url,
        force_reindex,
        on_progress,
        provider=provider,
        api_key=api_key,
        chat_model=chat_model,
        embed_model=embed_model,
    )
    _jobs[job_id]["result"] = result

    if result.status == IndexStatus.FAILED:
        _jobs[job_id]["status"] = IndexStatus.FAILED
        _jobs[job_id]["error"]  = result.error
    else:
        _jobs[job_id]["status"] = IndexStatus.DONE


@app.post("/analyse", response_model=AnalyseResponse)
async def analyse(req: AnalyseRequest, background_tasks: BackgroundTasks):
    """
    Kick off repo indexing. Returns a job_id to poll for status.
    """
    job_id = str(uuid.uuid4())[:8]

    # Derive a provisional repo_id (will be overwritten once cloner runs)
    import hashlib
    provisional_id = hashlib.sha1(req.github_url.lower().encode()).hexdigest()[:16]

    _jobs[job_id] = {
        "job_id":  job_id,
        "repo_id": provisional_id,
        "status":  IndexStatus.PENDING,
        "message": "Job queued",
        "result":  None,
        "error":   None,
    }

    background_tasks.add_task(
        _run_index_job,
        job_id,
        req.github_url,
        req.force_reindex,
        req.provider,
        req.api_key,
        req.chat_model,
        req.embed_model,
    )

    return AnalyseResponse(
        job_id  = job_id,
        repo_id = provisional_id,
        message = "Indexing started. Poll /status/{job_id} for updates.",
    )




class StatusResponse(BaseModel):
    job_id:      str
    status:      IndexStatus
    message:     str
    chunk_count: Optional[int] = None
    repo_id:     Optional[str] = None
    error:       Optional[str] = None


@app.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    """Poll this endpoint until status == 'done' or 'failed'."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")

    result: IndexResult | None = job.get("result")

    return StatusResponse(
        job_id      = job_id,
        status      = job["status"],
        message     = job.get("message", ""),
        chunk_count = result.chunk_count if result else None,
        repo_id     = result.repo_id     if result else job.get("repo_id"),
        error       = job.get("error"),
    )


#  POST /chat 
class ChatRequest(BaseModel):
    query:   str
    repo_id: str
    history: list[dict[str, str]] = Field(default_factory=list)
    top_k:   int = 8
    provider:    str = "openai"
    api_key:     str | None = None
    chat_model:  str | None = None
    embed_model: str | None = None


class SourceOut(BaseModel):
    file_path:  str
    start_line: int
    end_line:   int
    language:   str
    score:      float


class ChatResponse(BaseModel):
    answer:  str
    sources: list[SourceOut]
    query:   str
    repo_id: str


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Ask a question about an indexed repo.
    Include prior turns in `history` for multi-turn conversations.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Import here so the API can boot even when AI dependencies are not configured.
    from pipeline.retriever import answer_query

    def _sanitize_error(msg: str) -> str:
        # redact common provider API key patterns and query-string secrets
        msg = re.sub(r"(?i)(sk-|pcsk_)[A-Za-z0-9_\-]{8,}", "<redacted key>", msg)
        msg = re.sub(r"(?i)([?&](?:key|api_key)=)[^'\"\s&]+", r"\1<redacted key>", msg)
        msg = re.sub(r"AIza[0-9A-Za-z_\-]{20,}", "<redacted key>", msg)
        return msg

    try:
        result = answer_query(
            query   = req.query,
            repo_id = req.repo_id,
            history = req.history,
            top_k   = req.top_k,
            provider = req.provider,
            api_key = req.api_key,
            chat_model = req.chat_model,
            embed_model = req.embed_model,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - runtime protection
        import traceback
        traceback.print_exc()
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        reason = getattr(getattr(exc, "response", None), "reason_phrase", None)
        if status_code and reason:
            detail = (
                f"Upstream provider error: {status_code} {reason}. "
                f"Check the provider, model name, and API key."
            )
        else:
            detail = "Upstream provider error. Check the provider, model name, and API key."
        raise HTTPException(status_code=502, detail=_sanitize_error(detail))

    return ChatResponse(
        answer  = result.answer,
        sources = [
            SourceOut(
                file_path  = s.file_path,
                start_line = s.start_line,
                end_line   = s.end_line,
                language   = s.language,
                score      = s.score,
            )
            for s in result.sources
        ],
        query   = result.query,
        repo_id = result.repo_id,
    )




@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
