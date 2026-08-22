"""
Talks to the GitHub REST API. Nothing else in the app should import
`httpx` for GitHub calls — go through here so rate-limit handling,
auth, and endpoint choices live in one place.
"""
import base64
from typing import Dict, List

import httpx

from app.core.config import settings

GITHUB_API = "https://api.github.com"

SKIP_EXT = (".lock", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".ttf", ".md", ".gitignore")
SKIP_DIRS = ("node_modules/", ".git/", "dist/", "build/", "venv/", "__pycache__/")


def _headers() -> dict:
    if settings.github_token:
        return {"Authorization": f"Bearer {settings.github_token}"}
    return {}


async def fetch_repo_files(repo_url: str, max_files: int = 12) -> List[Dict]:
    """
    Given a public GitHub repo URL, pull a sample of source files
    (path + content) to feed the quiz generator. Skips binaries,
    locks, and build output.
    """
    owner_repo = repo_url.rstrip("/").split("github.com/")[-1]
    owner, repo = owner_repo.split("/")[:2]

    async with httpx.AsyncClient(timeout=20, headers=_headers()) as client:
        tree_resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/main?recursive=1")
        if tree_resp.status_code != 200:
            tree_resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/master?recursive=1")
        tree_resp.raise_for_status()
        tree = tree_resp.json().get("tree", [])

        candidates = [
            item
            for item in tree
            if item["type"] == "blob"
            and not item["path"].lower().endswith(SKIP_EXT)
            and not any(item["path"].startswith(d) for d in SKIP_DIRS)
        ]
        candidates.sort(key=lambda i: i.get("size", 0))  # prefer smaller, likely-source files

        files = []
        for item in candidates[:max_files]:
            file_resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{item['path']}")
            if file_resp.status_code != 200:
                continue
            data = file_resp.json()
            if data.get("encoding") == "base64":
                content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
                files.append({"path": item["path"], "content": content[:4000]})

        return files
