"""
pipeline/chunker.py
────────────────────
Walks a cloned repo, reads every supported file, and splits it into
overlapping token-aware chunks. Each chunk carries metadata so we
can cite exact file + line ranges in answers.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

import tiktoken

from config import (
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    SUPPORTED_EXTENSIONS,
    SKIP_DIRS,
)

# ── Data models ─

@dataclass
class Chunk:
    """One piece of source text ready for embedding."""
    text:       str
    repo_id:    str
    file_path:  str          # relative path inside repo
    start_line: int
    end_line:   int
    language:   str
    chunk_index: int         # 0-based index within the file
    metadata: dict = field(default_factory=dict)


# ── Token counting 

_enc = tiktoken.get_encoding("cl100k_base")

def _token_len(text: str) -> int:
    return len(_enc.encode(text, disallowed_special=()))

def _token_chunks(text: str, size: int, overlap: int) -> list[str]:
    """Split *text* into token-bounded chunks with *overlap* tokens of context."""
    tokens = _enc.encode(text, disallowed_special=())
    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + size, len(tokens))
        chunks.append(_enc.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start += size - overlap
    return chunks


# ── Language detection

_EXT_TO_LANG = {
    ".py": "python", ".ts": "typescript", ".tsx": "tsx",
    ".js": "javascript", ".jsx": "jsx", ".go": "go",
    ".rs": "rust", ".java": "java", ".cpp": "cpp",
    ".c": "c", ".h": "c", ".md": "markdown", ".mdx": "markdown",
    ".yaml": "yaml", ".yml": "yaml", ".json": "json",
    ".toml": "toml", ".sh": "bash", ".txt": "text",
}

def _detect_language(path: Path) -> str:
    return _EXT_TO_LANG.get(path.suffix.lower(), "text")


# ── File walker 

def _walk_files(repo_root: Path) -> Iterator[Path]:
    """Yield all indexable files, skipping noise dirs and binary blobs."""
    for fpath in repo_root.rglob("*"):
        if not fpath.is_file():
            continue
        # Skip noise directories
        if any(part in SKIP_DIRS for part in fpath.parts):
            continue
        # Skip unsupported extensions
        if fpath.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        # Skip huge files (> 200 KB) — usually generated/minified
        if fpath.stat().st_size > 200_000:
            continue
        yield fpath


# ── Smart splitters 

def _split_by_functions(text: str, language: str) -> list[tuple[str, int]]:
    """
    Try to split code at function/class boundaries for cleaner chunks.
    Returns list of (block_text, start_line_in_file).
    Falls back to raw lines if no pattern matches.
    """
    patterns = {
        "python":     r"^(def |class |\@)",
        "typescript": r"^(export |function |class |const \w+ = \(|async function)",
        "javascript": r"^(export |function |class |const \w+ = \(|async function)",
        "go":         r"^func ",
        "rust":       r"^(pub fn |fn |impl |pub struct |struct )",
        "java":       r"^(public |private |protected |class )",
    }
    pattern = patterns.get(language)
    if not pattern:
        return [(text, 0)]

    lines   = text.splitlines(keepends=True)
    blocks:  list[tuple[str, int]] = []
    current: list[str] = []
    start_ln = 0

    for i, line in enumerate(lines):
        if re.match(pattern, line) and current:
            blocks.append(("".join(current), start_ln))
            current  = [line]
            start_ln = i
        else:
            current.append(line)

    if current:
        blocks.append(("".join(current), start_ln))

    return blocks if blocks else [(text, 0)]


# ── Public API 

def chunk_repo(repo_root: Path, repo_id: str) -> list[Chunk]:
    """
    Walk *repo_root* and return all Chunk objects ready for embedding.

    Strategy:
      1. Split file into logical blocks (functions/classes) where possible.
      2. If a block is still larger than CHUNK_SIZE tokens, further split it
         with token-aware sliding window + overlap.
    """
    all_chunks: list[Chunk] = []

    for fpath in _walk_files(repo_root):
        rel_path = str(fpath.relative_to(repo_root))
        language = _detect_language(fpath)

        try:
            text = fpath.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"[chunker] Skipping {rel_path}: {e}")
            continue

        if not text.strip():
            continue

        lines      = text.splitlines()
        blocks     = _split_by_functions(text, language)
        chunk_idx  = 0

        for block_text, block_start_line in blocks:
            # If block fits in one chunk, emit as-is
            if _token_len(block_text) <= CHUNK_SIZE:
                block_lines = block_text.count("\n")
                all_chunks.append(Chunk(
                    text        = block_text.strip(),
                    repo_id     = repo_id,
                    file_path   = rel_path,
                    start_line  = block_start_line + 1,
                    end_line    = block_start_line + block_lines + 1,
                    language    = language,
                    chunk_index = chunk_idx,
                ))
                chunk_idx += 1
            else:
                # Slide a token window through the block
                sub_chunks = _token_chunks(block_text, CHUNK_SIZE, CHUNK_OVERLAP)
                offset     = block_start_line
                for sub in sub_chunks:
                    sub_lines = sub.count("\n")
                    all_chunks.append(Chunk(
                        text        = sub.strip(),
                        repo_id     = repo_id,
                        file_path   = rel_path,
                        start_line  = offset + 1,
                        end_line    = offset + sub_lines + 1,
                        language    = language,
                        chunk_index = chunk_idx,
                    ))
                    chunk_idx += 1
                    offset   += sub_lines

    print(f"[chunker] {len(all_chunks)} chunks from {repo_root}")
    return all_chunks
