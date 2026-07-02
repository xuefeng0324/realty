"""
生成 daily_wangqian.csv 的远端 meta，供 App jsDelivr 刷新。

输出：realty_app/static/wangqian_meta.json
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = REPO_ROOT / "static" / "daily_wangqian.csv"
META_PATH = REPO_ROOT / "static" / "wangqian_meta.json"


def _gh_remote_origin() -> str | None:
    try:
        out = subprocess.check_output(
            ["git", "config", "--get", "remote.origin.url"],
            cwd=REPO_ROOT.parent,
            text=True,
        ).strip()
    except Exception:
        return None
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


def main() -> None:
    if not CSV_PATH.exists():
        print(f"[publish_wangqian_meta] {CSV_PATH} 不存在")
        return
    repo = _gh_remote_origin() or "xuefeng0324/realty"
    base = f"https://cdn.jsdelivr.net/gh/{repo}@main/realty_app/static"
    csv_sha = _sha256(CSV_PATH)
    row_count = sum(1 for _ in open(CSV_PATH, "rb")) - 1
    meta = {
        "csv_url": f"{base}/daily_wangqian.csv",
        "meta_url": f"{base}/wangqian_meta.json",
        "sha256": csv_sha,
        "row_count": row_count,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "wangqian",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"[publish_wangqian_meta] {csv_sha} {row_count} rows -> {META_PATH}")


if __name__ == "__main__":
    main()
