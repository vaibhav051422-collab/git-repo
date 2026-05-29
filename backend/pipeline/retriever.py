"""
pipeline/retriever.py
──────────────────────
Given a user query + repo_id:
  1. Embed the query
  2. Retrieve top-k chunks from Pinecone
  3. Feed retrieved context to GPT-4o
  4. Return a cited answer
"""
from __future__ import annotations

from dataclasses import dataclass

from config import (
    TOP_K,
)
from pipeline.ai_clients import AISettings, answer_text, embed_texts, normalize_provider
from pipeline.embedder import ensure_index


# Data models 

@dataclass
class SourceChunk:
    file_path:  str
    start_line: int
    end_line:   int
    language:   str
    text:       str
    score:      float


@dataclass
class ChatAnswer:
    answer:   str
    sources:  list[SourceChunk]
    query:    str
    repo_id:  str


# System prompt

SYSTEM_PROMPT = """\
You are RepoChat, an expert code assistant. You answer questions about a \
specific GitHub repository using retrieved source code chunks.

Rules:
- Always cite the file path and line numbers for every claim you make.
- Format citations inline like: `src/auth/middleware.ts:42-58`
- If the answer is not in the provided context, say so clearly. Do NOT \
  hallucinate code or file paths.
- Be concise. Developers value precision over verbosity.
- Use code blocks (```language) when showing code snippets.
- If multiple files are relevant, mention each one.
"""


#  Retrieval 

def _retrieve(query_vec: list[float], repo_id: str, top_k: int, settings: AISettings) -> list[SourceChunk]:
    index   = ensure_index(settings)
    results = index.query(
        vector    = query_vec,
        top_k     = top_k,
        namespace = repo_id,
        include_metadata = True,
    )

    chunks: list[SourceChunk] = []
    for match in results.matches:
        meta = match.metadata or {}
        chunks.append(SourceChunk(
            file_path  = meta.get("file_path",  "unknown"),
            start_line = int(meta.get("start_line", 0)),
            end_line   = int(meta.get("end_line",   0)),
            language   = meta.get("language",   "text"),
            text       = meta.get("text",        ""),
            score      = round(match.score, 4),
        ))
    return chunks


#  Context builder

def _build_context(chunks: list[SourceChunk]) -> str:
    """Format retrieved chunks into an LLM-readable context block."""
    parts = []
    for i, c in enumerate(chunks, 1):
        header = (
            f"### Chunk {i} — {c.file_path} "
            f"(lines {c.start_line}–{c.end_line}, score={c.score})"
        )
        parts.append(f"{header}\n```{c.language}\n{c.text}\n```")
    return "\n\n".join(parts)


#  Conversation history support 

Message = dict  # {"role": "user"|"assistant", "content": str}


#  Public API

def answer_query(
    query:   str,
    repo_id: str,
    history: list[Message] | None = None,
    top_k:   int = TOP_K,
    provider: str = "openai",
    api_key: str | None = None,
    chat_model: str | None = None,
    embed_model: str | None = None,
) -> ChatAnswer:
    """
    Answer *query* about *repo_id*.

    Args:
        query:   The user's natural-language question.
        repo_id: Pinecone namespace for this repo.
        history: Prior conversation turns for multi-turn chat.
        top_k:   Number of chunks to retrieve.

    Returns:
        ChatAnswer with the synthesised answer and cited sources.
    """
    settings = AISettings(
        provider=normalize_provider(provider),
        api_key=api_key,
        chat_model=chat_model,
        embed_model=embed_model,
    )

    # 1. Embed the query
    query_vec = embed_texts([query], settings)[0]

    # 2. Retrieve relevant chunks
    sources = _retrieve(query_vec, repo_id, top_k, settings)

    if not sources:
        return ChatAnswer(
            answer  = "I couldn't find relevant code for that query in this repo.",
            sources = [],
            query   = query,
            repo_id = repo_id,
        )

    # 3. Build context and generate the answer
    context = _build_context(sources)
    answer_text_result = answer_text(
        settings=settings,
        system_prompt=SYSTEM_PROMPT,
        history=history,
        retrieved_context=context,
        question=query,
    )

    return ChatAnswer(
        answer  = answer_text_result,
        sources = sources,
        query   = query,
        repo_id = repo_id,
    )
