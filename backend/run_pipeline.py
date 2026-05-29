#!/usr/bin/env python3
"""
run_pipeline.py
───────────────
Quick CLI to test the full RAG pipeline locally.

Usage:
  # Index a repo
  python run_pipeline.py index https://github.com/tiangolo/fastapi

  # Chat with an indexed repo
  python run_pipeline.py chat <repo_id> "Where is dependency injection handled?"

  # Index + immediately chat
  python run_pipeline.py demo https://github.com/tiangolo/fastapi
"""
import sys

def cmd_index(github_url: str, force: bool = False):
    from pipeline.indexer import index_repo, IndexStatus
    print(f"\n{'─'*50}")
    print(f" Indexing: {github_url}")
    print(f"{'─'*50}\n")
    result = index_repo(github_url, force_reindex=force)
    if result.status == IndexStatus.DONE:
        print(f"\n Done! repo_id = {result.repo_id}  |  {result.chunk_count} vectors")
    else:
        print(f"\n Failed: {result.error}")
    return result


def cmd_chat(repo_id: str, query: str):
    from pipeline.retriever import answer_query
    print(f"\n{'─'*50}")
    print(f" Q: {query}")
    print(f"{'─'*50}\n")
    answer = answer_query(query, repo_id)
    print(answer.answer)
    print(f"\n{'─'*50}")
    print(f"Sources ({len(answer.sources)}):")
    for s in answer.sources:
        print(f"  • {s.file_path}:{s.start_line}-{s.end_line}  (score={s.score})")


def cmd_demo(github_url: str):
    result = cmd_index(github_url)
    if result.repo_id:
        questions = [
            "Give me a high-level overview of this codebase.",
            "Where is the main entry point?",
            "How is error handling done?",
        ]
        for q in questions:
            cmd_chat(result.repo_id, q)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)

    command = args[0]
    if command == "index" and len(args) >= 2:
        cmd_index(args[1], force="--force" in args)
    elif command == "chat" and len(args) >= 3:
        cmd_chat(args[1], " ".join(args[2:]))
    elif command == "demo" and len(args) >= 2:
        cmd_demo(args[1])
    else:
        print(__doc__)
