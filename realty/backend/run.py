from __future__ import annotations

import os
import sys

import uvicorn


def main() -> None:
    # Ensure repo root is on sys.path so `realty.*` imports work when running `realty/backend/run.py`
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)

    # MVP：先关闭 reload，避免 Windows 多进程重载导致卡死/占用端口
    uvicorn.run("realty.backend.app.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
