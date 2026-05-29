"""
pipeline/embedder.py
─────────────────────
Converts Chunk objects → OpenAI embeddings → Pinecone vectors.
Handles batching, retries, and namespace isolation per repo.
"""
from __future__ import annotations

import time
from typing import Any

from pinecone import Pinecone, ServerlessSpec

from config import PINECONE_API_KEY
from pipeline.ai_clients import AISettings, get_embedding_dimension, get_index_name, normalize_provider, embed_texts
from pipeline.chunker import Chunk

_pc  = Pinecone(api_key=PINECONE_API_KEY)

#Index bootstrap

def ensure_index(settings: AISettings) -> Any:
    """Create the Pinecone index if it doesn't exist yet."""
    provider = normalize_provider(settings.provider)
    index_name = get_index_name(provider)
    embed_model = settings.embed_model or ""
    embed_dim = get_embedding_dimension(provider, embed_model)
    existing = [idx.name for idx in _pc.list_indexes()]
    if index_name not in existing:
        print(f"[embedder] Creating Pinecone index '{index_name}'…")
        _pc.create_index(
            name      = index_name,
            dimension = embed_dim,
            metric    = "cosine",
            spec      = ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        # Wait for index to be ready
        while not _pc.describe_index(index_name).status["ready"]:
            print("[embedder] Waiting for index to be ready…")
            time.sleep(2)
        print("[embedder] Index ready ✓")
    return _pc.Index(index_name)


# Embedding

EMBED_BATCH = 96   # OpenAI allows up to 2048; keep lower for stability

# ── Upsert ────────────────────────────────────────────────────────────────────

UPSERT_BATCH = 100   # Pinecone upsert limit per request

def _chunk_to_pinecone_vector(chunk: Chunk, vector: list[float]) -> dict:
    """Package a Chunk + its embedding into a Pinecone upsert record."""
    vector_id = f"{chunk.repo_id}_{chunk.file_path}_{chunk.chunk_index}"
    # Sanitise the ID (Pinecone doesn't allow slashes)
    vector_id = vector_id.replace("/", "__").replace("\\", "__")

    return {
        "id":     vector_id,
        "values": vector,
        "metadata": {
            "repo_id":    chunk.repo_id,
            "file_path":  chunk.file_path,
            "start_line": chunk.start_line,
            "end_line":   chunk.end_line,
            "language":   chunk.language,
            # Store first 1 000 chars as searchable snippet
            "text":       chunk.text[:1_000],
        },
    }


def embed_and_store(chunks: list[Chunk], settings: AISettings) -> int:
    """
    Embed all *chunks* and upsert into Pinecone.

    Each repo gets its own namespace so queries are always scoped
    to a single repo and namespaces can be deleted independently.

    Returns the number of vectors upserted.
    """
    if not chunks:
        return 0

    index     = ensure_index(settings)
    namespace = chunks[0].repo_id   # all chunks in a job share the same repo_id
    total     = 0

    print(f"[embedder] Embedding {len(chunks)} chunks for namespace '{namespace}'…")

    
    vectors_to_upsert: list[dict] = []

    for i in range(0, len(chunks), EMBED_BATCH):
        batch  = chunks[i : i + EMBED_BATCH]
        texts  = [c.text for c in batch]

        try:
            embeddings = embed_texts(texts, settings)
        except Exception as e:
            print(f"[embedder] Embedding batch {i//EMBED_BATCH} failed: {e}, retrying…")
            time.sleep(2)
            embeddings = embed_texts(texts, settings)   # one retry

        for chunk, vec in zip(batch, embeddings):
            vectors_to_upsert.append(_chunk_to_pinecone_vector(chunk, vec))

        pct = min(100, round((i + len(batch)) / len(chunks) * 100))
        print(f"[embedder] Embedded {i + len(batch)}/{len(chunks)} ({pct}%)")

    # Upsert into Pinecone 
    for j in range(0, len(vectors_to_upsert), UPSERT_BATCH):
        batch = vectors_to_upsert[j : j + UPSERT_BATCH]
        index.upsert(vectors=batch, namespace=namespace)
        total += len(batch)

    print(f"[embedder] Upserted {total} vectors into namespace '{namespace}' ✓")
    return total


def delete_repo_index(repo_id: str, settings: AISettings) -> None:
    """Remove all vectors for a repo (e.g. on re-index or deletion)."""
    index = ensure_index(settings)
    index.delete(delete_all=True, namespace=repo_id)
    print(f"[embedder] Deleted namespace '{repo_id}'")
# py -m uvicorn api.main:app --reload --port 8000