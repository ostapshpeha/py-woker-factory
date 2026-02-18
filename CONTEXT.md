# Project Context: Worker Factory AI Orchestrator

## Overview
This is a frontend application for a highly scalable AI Agent Orchestrator. The system manages autonomous AI workers running inside isolated Docker containers. The frontend needs to be built with React, TypeScript, and Tailwind CSS.

## Backend Architecture (DooD - Docker out of Docker)
The backend is built with FastAPI, Celery, Redis, and PostgreSQL.
1. **Workers:** We dynamically spawn Kasm Ubuntu containers (headless VMs) for each AI worker.
2. **Tasks:** Users submit prompts, which are sent via Celery to the worker's container. The worker runs `open-interpreter` to execute autonomous logic.
3. **Live View:** We have a real-time screenshot system using `scrot` inside the container, uploading directly to AWS S3, and returning a Presigned URL.

## The Worker Dockerfile Context
To understand the AI environment: The worker (`Dockerfile-worker`) is based on `kasmweb/core-ubuntu-jammy`. It installs `python3`, `pip`, and `open-interpreter`. At runtime, we inject CLI tools like `google-chrome-stable`, `w3m`, and `scrot`. 
*Important UI impact:* The AI acts autonomously without a visible terminal to the user. The only visual output the user sees is the final screenshot (e.g., a PDF opened in Chrome or a plotted graph).

## Key API Endpoints to Integrate
Base URL: `http://localhost:8000/api`

### 1. Worker Management
- `GET /workers`: List all workers belonging to the user.
- `POST /workers`: Spawn a new container.
- **Data Model:** `{ id: number, name: string, status: "OFFLINE" | "IDLE" | "BUSY" | "ERROR" }`

### 2. Live Screenshot View (Crucial)
- `GET /workers/{worker_id}/screenshot`
- **Behavior:** This endpoint has a 30-second cooldown on the backend. It synchronously connects to the Docker container, takes a screenshot, uploads to S3, and returns a 10-hour presigned URL.
- **Frontend Requirement:** Create a polling hook (`useWorkerStream`) that hits this endpoint every 10-15 seconds. If it gets a new image URL, update the UI. Display a spinner/loading state on the first load.

### 3. Task Execution
- `POST /tasks`: Submit a prompt to a worker. Body: `{ worker_id: number, prompt: string }`
- `GET /tasks/{task_id}`: Check task status and read logs.
- **Data Model:** `{ id: number, prompt: string, result: string, logs: string, status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" }`

## Frontend Requirements & Design Guidelines
1. **Dashboard Layout:** A modern, dark-themed SaaS interface. Sidebar for navigating between Workers, a central area for the "Live View" (Image component displaying the S3 URL), and a bottom/side panel for streaming text logs from the Task.
2. **TypeScript:** Strictly type all API responses.
3. **Styling:** Use Tailwind CSS. Make it look futuristic but clean.
4. **State Management:** Keep it simple. React Context or Zustand is preferred.

Please act as a Senior Frontend Developer. Review this architecture and await my command to build the specific components.