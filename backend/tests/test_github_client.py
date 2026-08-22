"""
Repo file selection.

Both cases here are regressions. The original code sorted ascending and took the
smallest files, which selected empty __init__.py files and produced questions
asking why blank files were blank — while still returning HTTP 200. The SKIP_DIRS
check used a path prefix, so nested vendored directories were never excluded;
harmless while the smallest files were preferred, load-bearing once the largest are.
"""
import base64

import pytest

from app.integrations import github_client


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code != 200:
            raise AssertionError(f"unexpected status {self.status_code}")


class FakeClient:
    """Stands in for httpx.AsyncClient: serves one tree and file contents."""

    def __init__(self, tree, missing_branches=(), **kwargs):
        self.tree = tree
        self.missing_branches = missing_branches
        self.requested = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url):
        self.requested.append(url)
        if "/git/trees/" in url:
            branch = url.split("/git/trees/")[1].split("?")[0]
            if branch in self.missing_branches:
                return FakeResponse({}, status_code=404)
            return FakeResponse({"tree": self.tree})
        path = url.split("/contents/")[1]
        return FakeResponse({
            "encoding": "base64",
            "content": base64.b64encode(f"source of {path}".encode()).decode(),
        })


def blob(path, size):
    return {"type": "blob", "path": path, "size": size}


@pytest.fixture
def patch_client(monkeypatch):
    def apply(tree, missing_branches=()):
        holder = {}

        def factory(**kwargs):
            holder["client"] = FakeClient(tree, missing_branches, **kwargs)
            return holder["client"]

        monkeypatch.setattr(github_client.httpx, "AsyncClient", factory)
        return holder

    return apply


async def test_prefers_largest_files_and_drops_stubs(patch_client):
    patch_client([
        blob("app/__init__.py", 0),
        blob("app/schemas/__init__.py", 0),
        blob("py.typed", 12),
        blob("app/service.py", 4000),
        blob("app/client.py", 2000),
        blob("app/tiny.py", 150),  # under the 200-byte floor
    ])
    files = await github_client.fetch_repo_files("https://github.com/o/r")

    paths = [f["path"] for f in files]
    assert paths == ["app/service.py", "app/client.py"]
    assert not any("__init__" in p for p in paths), "empty stubs must never be selected"


async def test_excludes_nested_vendored_directories(patch_client):
    patch_client([
        blob("frontend/node_modules/react/index.js", 9000),
        blob("backend/dist/bundle.js", 8000),
        blob("src/build/out.js", 7000),
        blob("backend/__pycache__/x.pyc", 6000),
        blob("app/main.py", 1000),
    ])
    files = await github_client.fetch_repo_files("https://github.com/o/r")
    assert [f["path"] for f in files] == ["app/main.py"]


async def test_does_not_exclude_lookalike_paths(patch_client):
    """`dist/` must not match `mydist/`, and a file named build.py is fine."""
    patch_client([
        blob("mydist/helper.py", 3000),
        blob("rebuild/tool.py", 2500),
        blob("app/build.py", 2000),
    ])
    files = await github_client.fetch_repo_files("https://github.com/o/r")
    assert sorted(f["path"] for f in files) == ["app/build.py", "mydist/helper.py", "rebuild/tool.py"]


async def test_skips_binaries_and_docs(patch_client):
    patch_client([
        blob("README.md", 5000),
        blob("logo.png", 4000),
        blob("uv.lock", 9000),
        blob("app/main.py", 1000),
    ])
    files = await github_client.fetch_repo_files("https://github.com/o/r")
    assert [f["path"] for f in files] == ["app/main.py"]


async def test_falls_back_to_master_branch(patch_client):
    holder = patch_client([blob("app/main.py", 1000)], missing_branches=("main",))
    files = await github_client.fetch_repo_files("https://github.com/o/r")
    assert [f["path"] for f in files] == ["app/main.py"]
    assert any("trees/master" in u for u in holder["client"].requested)


async def test_returns_empty_when_nothing_qualifies(patch_client):
    """Drives the 400 the endpoint returns for a repo with no usable source."""
    patch_client([blob("README.md", 5000), blob("app/__init__.py", 0)])
    assert await github_client.fetch_repo_files("https://github.com/o/r") == []


async def test_respects_max_files(patch_client):
    patch_client([blob(f"app/mod{i}.py", 1000 + i) for i in range(30)])
    files = await github_client.fetch_repo_files("https://github.com/o/r", max_files=4)
    assert len(files) == 4
