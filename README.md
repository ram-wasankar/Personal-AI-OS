# Synapse Keeper Pro

Production-ready full-stack knowledge assistant with:

- FastAPI backend (layered architecture)
- MongoDB Atlas for persistence
- FAISS vector index for retrieval
- RAG chat pipeline with memory injection
- Existing React UI wired to real APIs

## Architecture

Frontend:

- Vite + React + TypeScript + Tailwind
- Existing UI kept intact, now connected to APIs

Backend:

- `backend/app/routes`: API handlers
- `backend/app/services`: business logic
- `backend/app/models`: request/response schemas
- `backend/app/db`: MongoDB connection and indexes
- `backend/app/services/rag_service.py`: embedding + FAISS index management
- `backend/app/services/memory_service.py`: memory extraction and relevance scoring

## Implemented Endpoints

Auth:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Notes:

- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/{id}`
- `DELETE /api/notes/{id}`

Documents:

- `GET /api/documents`
- `POST /api/upload`

Chat + Memory:

- `POST /api/chat`
- `POST /api/chat/stream` (SSE)
- `GET /api/memory`
- `GET /api/dashboard`

Utility:

- `GET /health`

## Database Collections (MongoDB)

- `users`: `email`, `password_hash`, timestamps
- `notes`: `user_id`, `title`, `content`, timestamps
- `documents`: `user_id`, `file_url`, `file_name`, `extracted_text`, `chunks`, `status`, timestamps
- `conversations`: `user_id`, `messages[]`, timestamps
- `memory`: `user_id`, `content`, `importance_score`, `last_accessed`, `memory_type`

## RAG Pipeline

1. Notes/documents are semantically chunked.
2. Chunks are embedded with `sentence-transformers`.
3. Embeddings are stored in a FAISS index.
4. Hybrid retrieval combines semantic FAISS search + BM25-like keyword scoring.
5. Candidates are reranked with confidence scoring and metadata filtering.
6. Relevant memory entries are retrieved with recency/frequency decay-aware scoring.
7. Final answer is generated with OpenAI (if API key is set), otherwise retrieval-grounded fallback response is returned.

## Production Upgrades

- Hybrid retrieval with reranking and confidence scores.
- Advanced memory model with frequency, decay, clustering, and semantic relevance.
- TTL caching layer (Redis-first with in-memory fallback) for retrieval, embeddings, and dashboard.
- Non-blocking document ingestion pipeline using async background worker.
- Structured JSON logging and request latency middleware.
- Pagination support on notes/documents/memory list endpoints.
- Streaming chat endpoint and frontend streaming UX.

## File Upload

- Supports `.pdf`, `.txt`, `.md`
- PDF extraction uses `pypdf`
- Files stored under `backend/storage/uploads`
- Metadata + extracted text stored in MongoDB
- Status lifecycle: `uploading` -> `processing` -> `ready` (or `failed`)

## Local Setup

### 1) Frontend

```bash
npm install
```

Create frontend env file:

```bash
cp .env.example .env
```

### 2) Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Set values in `backend/.env`:

- `MONGO_URI` (MongoDB Atlas)
- `JWT_SECRET` (or `SECRET_KEY`)
- `OPENAI_API_KEY` (optional but recommended)

### 3) Run

Backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
npm run dev
```

Frontend default API target is `http://localhost:8000`.

## Frontend Changes Completed

- Dashboard now loads `/api/dashboard`
- Chat now calls `/api/chat` and supports document upload attachment
- Notes now use real CRUD APIs
- Documents panel now uploads and lists real files
- Memory panel now loads real memory records
- Insights panel now reads dynamic insights and topic distribution

## Notes

- The frontend now uses explicit Sign up and Login screens and stores authenticated session data in local storage.
- User profile/auth metadata is persisted in MongoDB users collection (`full_name`, `email`, `password_hash`, `created_at`, `updated_at`, `last_login_at`, `last_logout_at`).
- FAISS metadata is persisted at `backend/storage/faiss_meta.json` and index at `backend/storage/faiss.index`.

## Docker (Backend)

Build and run:

```bash
cd backend
docker build -t synapse-keeper-api .
docker run --rm -p 8000:8000 --env-file .env synapse-keeper-api
```

## Vercel Frontend + Render Backend Connection

This repository is configured for reliable cross-platform connection:

- `render.yaml` defines backend deployment and CORS defaults.
- `vercel.json` rewrites frontend same-origin routes to Render backend.
- Frontend API client now defaults to same-origin when `VITE_API_URL` is unset.

### Recommended production setup

1. Deploy backend on Render using `render.yaml`.
2. Deploy frontend on Vercel with this repo root.
3. Keep `VITE_API_URL` unset in Vercel so requests use rewrites:
	- `/api/*` -> Render backend `/api/*`
	- `/uploads/*` -> Render backend `/uploads/*`
4. Redeploy both services.

### Local development

- Set `VITE_API_URL=http://localhost:8000` in root `.env`.

## Render Deployment (Backend)

This repository now includes [render.yaml](render.yaml) so Render runs the API from the correct backend directory.

### Deploy steps

1. In Render, create a new Blueprint service from this repository.
2. Render will read [render.yaml](render.yaml) and create `synapse-keeper-api` as a Python web service.
3. In the service Environment tab, set the following required values:
	- `MONGO_URI` (MongoDB Atlas connection string)
	- `CORS_ORIGINS` (comma-separated allowed origins; include your frontend URL, for example `https://your-frontend.onrender.com,http://localhost:8080`)
4. Optional values:
	- `OPENAI_API_KEY`
	- `REDIS_URL`

Python version pinning without dashboard option:

- Set `PYTHON_VERSION=3.11.11` in [render.yaml](render.yaml) (already included).
- Keep [.python-version](.python-version) and [backend/.python-version](backend/.python-version) in repo.

### Why the previous deploy failed

- Running `uvicorn app.main:app` from repository root fails because the app module is under [backend/app/main.py](backend/app/main.py).
- The Blueprint fixes this by using `rootDir: backend` and starting with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
