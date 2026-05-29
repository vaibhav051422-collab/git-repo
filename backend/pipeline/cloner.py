"""
pipeline/cloner.py
──────────────────
Clones a GitHub repo (public or private) into CLONE_DIR.
Returns the local path and basic repo metadata.
"""
import os
import re
import shutil
import hashlib
from pathlib import Path
from dataclasses import dataclass

import git  # GitPython
from git.exc import InvalidGitRepositoryError, NoSuchPathError

from config import CLONE_DIR, GITHUB_TOKEN


#  Data model

@dataclass
class RepoMeta:
    repo_id:    str   # stable hash used as Pinecone namespace
    owner:      str
    name:       str
    local_path: Path
    github_url: str
    default_branch: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_github_url(url: str) -> tuple[str, str]:
    """Return (owner, repo_name) from any common GitHub URL format."""
    url = url.rstrip("/").removesuffix(".git")

    # SSH:  git@github.com:owner/repo
    ssh_match = re.match(r"git@github\.com:([^/]+)/(.+)$", url)
    if ssh_match:
        return ssh_match.group(1), ssh_match.group(2)

    # HTTPS: https://github.com/owner/repo
    https_match = re.match(r"https?://github\.com/([^/]+)/([^/]+)", url)
    if https_match:
        return https_match.group(1), https_match.group(2)

    raise ValueError(f"Cannot parse GitHub URL: {url!r}")


def _make_clone_url(owner: str, name: str) -> str:
    """Inject token into HTTPS URL for private repo access."""
    if GITHUB_TOKEN:
        return f"https://{GITHUB_TOKEN}@github.com/{owner}/{name}.git"
    return f"https://github.com/{owner}/{name}.git"


def _repo_id(owner: str, name: str) -> str:
    """Deterministic short ID used as a Pinecone namespace."""
    raw = f"{owner}/{name}".lower()
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


# Public API 
def clone_repo(github_url: str, force_reclone: bool = False) -> RepoMeta:
    """
    Clone *github_url* to disk (or reuse existing clone).

    Args:
        github_url:    e.g. "https://github.com/vercel/next.js"
        force_reclone: delete existing clone and re-clone from scratch

    Returns:
        RepoMeta with local_path pointing to the cloned directory.
    """
    owner, name = _parse_github_url(github_url)
    repo_id     = _repo_id(owner, name)
    local_path  = Path(CLONE_DIR) / repo_id

    # ── Re-clone if requested
    if force_reclone and local_path.exists():
        shutil.rmtree(local_path)
        print(f"[cloner] Removed existing clone at {local_path}")

    # ── Use existing clone (only when the directory is a valid git repo)
    if local_path.exists():
        try:
            repo = git.Repo(local_path)
            print(f"[cloner] Reusing existing clone at {local_path}")
            # Pull latest changes
            try:
                repo.remotes.origin.pull()
                print("[cloner] Pulled latest changes")
            except Exception as e:
                print(f"[cloner] Warning: pull failed ({e}), using cached clone")
        except (InvalidGitRepositoryError, NoSuchPathError):
            # Previous failed clone left a non-empty, non-repo directory.
            print(f"[cloner] Found invalid clone directory at {local_path}, recreating")
            shutil.rmtree(local_path)
            clone_url = _make_clone_url(owner, name)
            repo = git.Repo.clone_from(
                clone_url,
                local_path,
                depth=1,
                single_branch=True,
            )
            print(f"[cloner] Clone complete ({_count_files(local_path)} files)")
    else:
        # ── Fresh clone ───────────────────────────────────────────────────────
        clone_url = _make_clone_url(owner, name)
        print(f"[cloner] Cloning {owner}/{name} → {local_path}")
        local_path.parent.mkdir(parents=True, exist_ok=True)

        repo = git.Repo.clone_from(
            clone_url,
            local_path,
            depth=1,        # shallow clone — we only need latest snapshot
            single_branch=True,
        )
        print(f"[cloner] Clone complete ({_count_files(local_path)} files)")

    default_branch = _get_default_branch(repo)

    return RepoMeta(
        repo_id        = repo_id,
        owner          = owner,
        name           = name,
        local_path     = local_path,
        github_url     = f"https://github.com/{owner}/{name}",
        default_branch = default_branch,
    )




def _get_default_branch(repo: git.Repo) -> str:
    try:
        return repo.active_branch.name
    except TypeError:
        return "main"


def _count_files(path: Path) -> int:
    return sum(1 for _ in path.rglob("*") if _.is_file())
