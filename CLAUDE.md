# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Agent Orchestrator using a **DooD (Docker out of Docker)** architecture. The backend spawns isolated KasmVNC Ubuntu containers per user, where OpenInterpreter executes autonomous AI tasks driven by Gemini. Users view execution via S3-hosted presigned screenshots.

## Commands

### Backend

```bash
# Start all services (FastAPI + PostgreSQL + Redis + Celery)
docker-compose up

# Database migrations (auto-runs on startup, or manually)
docker exec -it worker_factory_app alembic upgrade head

# Format backend code
poetry run black app
poetry run isort app

# Run tests
poetry run pytest
```

### Frontend (`cd frontend` first)

```bash
npm install
npm run dev        # Dev server (http://localhost:5173)
npm run build      # Production build
npm run lint       # ESLint
```

## Architecture

### Services (docker-compose)
| Service | Image | Role |
|---------|-------|------|
| `app` | `Dockerfile` (Python 3.13 slim) | FastAPI + Uvicorn |
| `db` | `postgres:16-alpine` | Primary data store |
| `redis` | `redis:7-alpine` | Celery message broker |
| `celery` | `Dockerfile` | Async task worker |

### API Structure
All endpoints under `/api/routers/v1/`:
- `/user/*` — registration, JWT auth (access 120min / refresh 7d), profile
- `/workers/*` — worker container lifecycle (max 3 per user), screenshot capture, task submission
- `/tasks/*` — task status and retrieval
- `GET /health` — health check

### Worker Lifecycle
```
WorkerStatus: OFFLINE → STARTING → IDLE ⟷ BUSY → OFFLINE
TaskStatus:   QUEUED → PROCESSING → COMPLETED | FAILED
```
1. `POST /workers` creates a DB record and spawns a KasmVNC container (`app/worker/docker_service.py`)
2. Celery task `run_oi_agent()` initializes OpenInterpreter inside the container (~3-4 min)
3. `POST /workers/{id}/tasks` queues `execute_worker_task()` via Celery; worker status → BUSY
4. Task script is **base64-encoded** and injected into the container for execution
5. `.md` skill files from `agent_code_shared/skills/` are injected into the OpenInterpreter system prompt

### Screenshot Flow
`GET /workers/{id}/screenshot` → 30-second cooldown enforced → runs `scrot` in container → extracts PNG from tar → uploads to S3 → returns 10-hour presigned URL. Daily cleanup scheduled via Celery Beat at 3 AM.

### Frontend
React 19 + TypeScript + Vite + Tailwind CSS 4. The frontend is in `frontend/`. The intended design is a dark-themed SaaS dashboard with a sidebar for workers, a central "Live View" (polling screenshot), and a log panel for task output. Screenshot polling target: every 10–15 seconds via a `useWorkerStream` hook.

## Key Files

| Path | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, router registration |
| `app/core/config.py` | Pydantic settings (DB, JWT, S3, Redis, Gemini) |
| `app/worker/docker_service.py` | Docker SDK: create/stop/exec containers |
| `app/worker/crud.py` | DB CRUD for workers and tasks |
| `app/celery_tasks/worker_tasks.py` | `run_oi_agent` and `execute_worker_task` Celery tasks |
| `app/core/utils.py` | `capture_desktop_screenshot()` |
| `app/core/s3.py` | Async S3 upload, delete, presigned URL |
| `Dockerfile-worker` | KasmVNC Ubuntu image for AI worker containers |
| `agent_code_shared/` | Mounted into worker containers; `skills/*.md` injected into LLM prompt |
| `.envsample` | Required environment variable template |

## Environment Setup

Copy `.envsample` to `.env` and fill in: PostgreSQL connection, Redis URL, JWT secrets, AWS S3 credentials (bucket, region, keys), and Gemini API key.

## Important Constraints

- **Max 3 workers per user** — enforced in `app/worker/crud.py:create_worker()`
- **Screenshot cooldown** — 30 seconds between captures per worker
- Worker containers use **dynamic port allocation** for VNC; ports are stored in the DB
- The `Dockerfile-worker` image must be **pre-built** and available before workers can be spawned
