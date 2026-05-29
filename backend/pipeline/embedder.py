"""
pipeline/embedder.py
─────────────────────
Converts Chunk objects → OpenAI embeddings → Pinecone vectors.
Handles batching, retries, and namespace isolation per repo.
"""
from __future__ import annotations

import time
from typing import Any

from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec

from config import (
    OPENAI_API_KEY,
    EMBED_MODEL,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
)
from pipeline.chunker import Chunk

# Clients

_oai = OpenAI(api_key=OPENAI_API_KEY)
_pc  = Pinecone(api_key=PINECONE_API_KEY)

# Dimension for text-embedding-3-large
EMBED_DIM = 3072

#Index bootstrap

def ensure_index() -> Any:
    """Create the Pinecone index if it doesn't exist yet."""
    existing = [idx.name for idx in _pc.list_indexes()]
    if PINECONE_INDEX_NAME not in existing:
        print(f"[embedder] Creating Pinecone index '{PINECONE_INDEX_NAME}'…")
        _pc.create_index(
            name      = PINECONE_INDEX_NAME,
            dimension = EMBED_DIM,
            metric    = "cosine",
            spec      = ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        # Wait for index to be ready
        while not _pc.describe_index(PINECONE_INDEX_NAME).status["ready"]:
            print("[embedder] Waiting for index to be ready…")
            time.sleep(2)
        print("[embedder] Index ready ✓")
    return _pc.Index(PINECONE_INDEX_NAME)


# Embedding

EMBED_BATCH = 96   # OpenAI allows up to 2048; keep lower for stability

def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of vectors."""
    response = _oai.embeddings.create(
        model = EMBED_MODEL,
        input = texts,
    )
    return [item.embedding for item in response.data]


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


def embed_and_store(chunks: list[Chunk]) -> int:
    """
    Embed all *chunks* and upsert into Pinecone.

    Each repo gets its own namespace so queries are always scoped
    to a single repo and namespaces can be deleted independently.

    Returns the number of vectors upserted.
    """
    if not chunks:
        return 0

    index     = ensure_index()
    namespace = chunks[0].repo_id   # all chunks in a job share the same repo_id
    total     = 0

    print(f"[embedder] Embedding {len(chunks)} chunks for namespace '{namespace}'…")

    
    vectors_to_upsert: list[dict] = []

    for i in range(0, len(chunks), EMBED_BATCH):
        batch  = chunks[i : i + EMBED_BATCH]
        texts  = [c.text for c in batch]

        try:
            embeddings = _embed_texts(texts)
        except Exception as e:
            print(f"[embedder] Embedding batch {i//EMBED_BATCH} failed: {e}, retrying…")
            time.sleep(2)
            embeddings = _embed_texts(texts)   # one retry

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


def delete_repo_index(repo_id: str) -> None:
    """Remove all vectors for a repo (e.g. on re-index or deletion)."""
    index = ensure_index()
    index.delete(delete_all=True, namespace=repo_id)
    print(f"[embedder] Deleted namespace '{repo_id}'")
