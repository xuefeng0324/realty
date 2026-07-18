"""
把当前 listings.csv 的"指纹"写到 crawl_meta.json，app 端用来判断"远端数据比包内新"。

输出：realty_app/static/seed/crawl_meta.json
  {
    "csv_url": "https://cdn.jsdelivr.net/gh/<user>/<repo>@main/realty_app/static/seed/listings.csv",
    "sha256": "abc123...",
    "row_count": 540,
    "generated_at": "2026-07-01T11:50:00Z",
    "source": "anjuke"
  }

这个文件每次 crawl 完都重新生成。app 端通过对比 "远端 sha256 != 包内 sha256" 触发刷新。
"""
from __future__ import annotations
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = REPO_ROOT / "static" / "seed" / "listings.csv"
META_PATH = REPO_ROOT / "static" / "seed" / "crawl_meta.json"
SEED_DIR = REPO_ROOT / "static" / "seed"
SCHEMA_VERSION = 2


def _gh_remote_origin() -> str | None:
    """解析 git remote origin → user/repo"""
    try:
        out = subprocess.check_output(
            ["git", "config", "--get", "remote.origin.url"],
            cwd=REPO_ROOT.parent,
            text=True,
        ).strip()
    except Exception:
        return None
    # git@github.com:foo/bar.git  /  https://github.com/foo/bar.git
    if out.startswith("git@"):
        m = out.split(":", 1)[1]
    elif "://" in out:
        m = out.split("://", 1)[1].split("/", 1)[1]
    else:
        m = out
    m = m.rstrip("/")
    if m.endswith(".git"):
        m = m[:-4]
    return m


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def _snapshot_sha256() -> str:
    h = hashlib.sha256()
    for path in sorted(SEED_DIR.glob("*.csv"), key=lambda p: p.name):
        h.update(path.name.encode("utf-8"))
        h.update(b"\0")
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
    return h.hexdigest()[:16]


def _row_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in sorted(SEED_DIR.glob("*.csv"), key=lambda p: p.name):
        with open(path, "rb") as f:
            counts[path.name] = max(0, sum(1 for _ in f) - 1)
    return counts


def main() -> None:
    if not CSV_PATH.exists():
        print(f"[publish_csv] {CSV_PATH} 不存在")
        return
    repo = _gh_remote_origin() or "<user>/<repo>"
    csv_url = f"https://cdn.jsdelivr.net/gh/{repo}@main/realty_app/static/seed/listings.csv"
    meta_url = f"https://cdn.jsdelivr.net/gh/{repo}@main/realty_app/static/seed/crawl_meta.json"
    csv_sha = _sha256(CSV_PATH)
    row_count = sum(1 for _ in open(CSV_PATH, "rb")) - 1  # 去掉 header
    row_counts = _row_counts()
    meta = {
        "csv_url": csv_url,
        "meta_url": meta_url,
        "sha256": csv_sha,
        "snapshot_sha256": _snapshot_sha256(),
        "schema_version": SCHEMA_VERSION,
        "row_count": row_count,
        "file_count": len(row_counts),
        "row_counts": row_counts,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "full-snapshot",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"[publish_csv] {csv_sha} {row_count} rows -> {META_PATH}")


if __name__ == "__main__":
    main()
