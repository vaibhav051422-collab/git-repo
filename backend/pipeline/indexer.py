"""
pipeline/indexer.py
────────────────────
Orchestrates full indexing flow:
  1. Clone repo
  2. Chunk files
  3. Embed + store vectors
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Callable

from pipeline.ai_clients import AISettings, normalize_provider


class IndexStatus(str, Enum):
    PENDING = "pending"
    CLONING = "cloning"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    DONE = "done"
    FAILED = "failed"


@dataclass
class IndexResult:
    status: IndexStatus
    repo_id: str | None = None
    chunk_count: int = 0
    error: str | None = None


ProgressCallback = Callable[[IndexStatus, str], None]


def _emit(progress_cb: ProgressCallback | None, status: IndexStatus, message: str) -> None:
    if progress_cb:
        progress_cb(status, message)


def index_repo(
    github_url: str,
    force_reindex: bool = False,
    on_progress: ProgressCallback | None = None,
    provider: str = "openai",
    api_key: str | None = None,
    chat_model: str | None = None,
    embed_model: str | None = None,
) -> IndexResult:
    """
    Run clone -> chunk -> embed pipeline for a single GitHub repo.
    """
    settings = AISettings(
        provider=normalize_provider(provider),
        api_key=api_key,
        chat_model=chat_model,
        embed_model=embed_model,
    )
    repo_id: str | None = None

    try:
        _emit(on_progress, IndexStatus.CLONING, "Cloning repository")

        # Lazy imports keep API startup lightweight and avoid failing at import time.
        from pipeline.cloner import clone_repo
        from pipeline.chunker import chunk_repo
        from pipeline.embedder import embed_and_store, delete_repo_index

        repo = clone_repo(github_url=github_url, force_reclone=force_reindex)
        repo_id = repo.repo_id

        if force_reindex:
            _emit(on_progress, IndexStatus.EMBEDDING, "Clearing previous vectors")
            delete_repo_index(repo_id, settings)

        _emit(on_progress, IndexStatus.CHUNKING, "Chunking repository files")
        chunks = chunk_repo(repo_root=repo.local_path, repo_id=repo_id)

        _emit(on_progress, IndexStatus.EMBEDDING, "Embedding and storing vectors")
        chunk_count = embed_and_store(chunks, settings)

        _emit(on_progress, IndexStatus.DONE, f"Indexing completed ({chunk_count} chunks)")
        return IndexResult(
            status=IndexStatus.DONE,
            repo_id=repo_id,
            chunk_count=chunk_count,
        )

    except Exception as exc:
        _emit(on_progress, IndexStatus.FAILED, f"Indexing failed: {exc}")
        return IndexResult(
            status=IndexStatus.FAILED,
            repo_id=repo_id,
            error=str(exc),
        )
