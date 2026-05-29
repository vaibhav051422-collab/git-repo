"""
pipeline/ai_clients.py
──────────────────────
Provider-aware AI helpers for chat + embeddings.
Supports OpenAI and Gemini with a per-request API key.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import httpx
from openai import OpenAI

from config import (
    CHAT_MODEL,
    EMBED_MODEL,
    GEMINI_API_KEY,
    GEMINI_CHAT_MODEL,
    GEMINI_EMBED_MODEL,
    OPENAI_API_KEY,
    PINECONE_INDEX_NAME,
)

ProviderName = Literal["openai", "gemini"]


@dataclass(frozen=True)
class AISettings:
    provider: ProviderName = "openai"
    api_key: str | None = None
    chat_model: str | None = None
    embed_model: str | None = None


def normalize_provider(provider: str | None) -> ProviderName:
    value = (provider or "openai").strip().lower()
    if value not in {"openai", "gemini"}:
        raise ValueError(f"Unsupported provider: {provider!r}")
    return value  # type: ignore[return-value]


def resolve_api_key(settings: AISettings) -> str:
    if settings.api_key and settings.api_key.strip():
        return settings.api_key.strip()
    if settings.provider == "openai":
        return OPENAI_API_KEY
    return GEMINI_API_KEY


def resolve_chat_model(settings: AISettings) -> str:
    if settings.chat_model and settings.chat_model.strip():
        return settings.chat_model.strip()
    return GEMINI_CHAT_MODEL if settings.provider == "gemini" else CHAT_MODEL


def resolve_embed_model(settings: AISettings) -> str:
    if settings.embed_model and settings.embed_model.strip():
        return settings.embed_model.strip()
    return GEMINI_EMBED_MODEL if settings.provider == "gemini" else EMBED_MODEL


def get_index_name(provider: ProviderName) -> str:
    return f"{PINECONE_INDEX_NAME}-{provider}"


def get_embedding_dimension(provider: ProviderName, embed_model: str) -> int:
    if provider == "gemini":
        return 768
    return 3072 if embed_model == "text-embedding-3-large" else 1536


def embed_texts(texts: list[str], settings: AISettings) -> list[list[float]]:
    api_key = resolve_api_key(settings)
    if not api_key:
        raise RuntimeError(
            f"No API key available for provider {settings.provider!r}. "
            "Pass api_key in the request or set it in the environment."
        )

    model = resolve_embed_model(settings)

    if settings.provider == "openai":
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(model=model, input=texts)
        return [item.embedding for item in response.data]

    vectors: list[list[float]] = []
    for text in texts:
        payload = {
            "content": {
                "parts": [{"text": text}],
            },
            "taskType": "retrieval_document",
            "outputDimensionality": 768,
        }
        if model == "gemini-embedding-2":
            # Gemini Embedding 2 uses instruction-style inputs and does not need taskType.
            payload = {
                "content": {
                    "parts": [{"text": text}],
                },
                "outputDimensionality": 768,
            }
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
            params={"key": api_key},
            json=payload,
            timeout=60.0,
        )
        response.raise_for_status()
        payload = response.json()
        vectors.append(list(payload["embedding"]["values"]))
    return vectors


def answer_text(
    *,
    settings: AISettings,
    system_prompt: str,
    history: list[dict[str, str]] | None,
    retrieved_context: str,
    question: str,
) -> str:
    api_key = resolve_api_key(settings)
    if not api_key:
        raise RuntimeError(
            f"No API key available for provider {settings.provider!r}."
        )

    chat_model = resolve_chat_model(settings)

    if settings.provider == "openai":
        client = OpenAI(api_key=api_key)
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-6:])
        messages.append(
            {
                "role": "user",
                "content": (
                    f"Retrieved context from the repository:\n\n{retrieved_context}\n\n"
                    f"---\n\nQuestion: {question}"
                ),
            }
        )
        response = client.chat.completions.create(
            model=chat_model,
            messages=messages,
            temperature=0.2,
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""

    prompt_parts = [
        system_prompt,
        "\nRetrieved context from the repository:\n",
        retrieved_context,
    ]
    if history:
        prompt_parts.append("\nConversation history:\n")
        for message in history[-6:]:
            prompt_parts.append(f"{message.get('role', 'user').title()}: {message.get('content', '')}\n")
    prompt_parts.append(f"\nQuestion: {question}")

    response = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{chat_model}:generateContent",
        params={"key": api_key},
        json={
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "".join(prompt_parts)}],
                }
            ]
        },
        timeout=90.0,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise RuntimeError(payload["error"].get("message", "Gemini request failed"))
    candidates = payload.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        return ""
    return parts[0].get("text", "")