"""
config.py — central settings loaded from .env
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── OpenAI ───────────────────────────────────────────────────────────────────
OPENAI_API_KEY: str   = os.environ["OPENAI_API_KEY"]
EMBED_MODEL:    str   = os.getenv("EMBED_MODEL", "text-embedding-3-large")
CHAT_MODEL:     str   = os.getenv("CHAT_MODEL",  "gpt-4o")

# ── Pinecone ─────────────────────────────────────────────────────────────────
PINECONE_API_KEY:    str = os.environ["PINECONE_API_KEY"]
PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "repochat")

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

# ── Cloning ───────────────────────────────────────────────────────────────────
CLONE_DIR:    str = os.getenv("CLONE_DIR", "/tmp/repochat_repos")
GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")

# ── Chunking ──────────────────────────────────────────────────────────────────
CHUNK_SIZE:    int = int(os.getenv("CHUNK_SIZE",    "400"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "80"))

# ── Retrieval ─────────────────────────────────────────────────────────────────
TOP_K: int = int(os.getenv("TOP_K", "8"))

# ── File extensions we index ──────────────────────────────────────────────────
SUPPORTED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".go", ".rs", ".java", ".cpp", ".c", ".h",
    ".md", ".mdx", ".txt", ".yaml", ".yml",
    ".json", ".toml", ".env.example", ".sh",
}

# Paths to always skip
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv",
    "venv", "dist", "build", ".next", ".turbo",
    "coverage", ".pytest_cache",
}
