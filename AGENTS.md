# AGENTS.md

## Cursor Cloud specific instructions

This repo is a monorepo with two products (see `README.md` for full details):

- **Desktop web app** — FastAPI backend (`realty/backend/`) + Vite/Vue 3 frontend (`realty/frontend/`).
- **Mobile app** — uni-app (`realty_app/`), fully offline (no backend needed in default seed/demo mode).

Standard install/run/test commands are documented in `README.md`, `realty/backend/README.md`,
`realty/frontend/README.md`, and `realty_app/README.md`. The notes below only capture
non-obvious, environment-specific caveats for this cloud VM.

### Python / backend

- **Python 3.11 is required for the backend, not the system default 3.12.** `requirements.txt`
  pins `numpy==1.24.4`, which has no cp312 wheel and fails to build from source on Python 3.12.
  The dev environment installs Python 3.11 (deadsnakes) and uses a virtualenv at
  `realty/backend/.venv`. Always invoke backend Python via that venv, e.g.
  `realty/backend/.venv/bin/python ...` (numpy itself is only used by the vendored, non-runtime
  Lianjia scraper).
- **Run all backend / script commands from the repo root** (`/workspace`), not from
  `realty/backend/`. `run.py` prepends the repo root to `sys.path` so `import realty.backend...`
  resolves; module scripts are invoked as `python -m realty.backend.app.scripts.<name>`.
- The database is **SQLite** at `realty/realty.db` (gitignored, absolute path resolved by
  `config.py` regardless of cwd). It is created/seeded during environment setup, so it persists in
  the VM snapshot. To rebuild from scratch: `init_db` then `seed_demo --reset` (the latter also
  computes the derived snapshot/score tables). These are data steps and are intentionally NOT in
  the startup update script.
- Backend tests: `realty/backend/.venv/bin/python -m pytest -q realty/backend/tests`.

### Services & ports (dev mode)

| Service | Dir | Command | Port |
|---|---|---|---|
| Backend API | repo root | `realty/backend/.venv/bin/python realty/backend/run.py` | 8000 (`/healthz`) |
| Desktop frontend | `realty/frontend` | `npm run dev` | 5173 |
| Mobile app (H5) | `realty_app` | `npm run dev:h5` | 5174 |

- The desktop frontend calls the backend at `http://localhost:8000` by default
  (override via `VITE_API_BASE_URL`). The mobile H5 app runs standalone from bundled CSVs and
  does not need the backend.
