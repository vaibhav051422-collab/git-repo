# RepoChat (Git profile analyzer)

Lightweight app that indexes a GitHub repository and exposes a chat-style interface to ask questions about the codebase. The workspace contains two deployable apps:

- `gitlink/` — Next.js frontend (UI, runs on Vercel)
- `backend/` — FastAPI backend (indexing, embeddings, retrieval — runs on Render or any container host)

## Features

- Drop/paste a GitHub repo URL and index it (clone → chunk → embed → index)
- Chat interface that answers questions using retrieved repository context
- Per-request provider API key support (users can paste their own OpenAI/Gemini keys in the browser)

## Architecture

- Frontend (`gitlink/`) calls backend endpoints:
  - `POST /analyse` — enqueue an indexing job
  - `GET /status/{job_id}` — poll job status
  - `POST /chat` — ask questions against the indexed repo
- Backend (`backend/`) runs background jobs, creates embeddings (Pinecone), and answers queries using provider APIs.

## Quickstart — Local development

1. Copy env examples into working env files

   ```bash
   cp gitlink/.env.example gitlink/.env.local
   cp backend/.env.example backend/.env
   ```

2. Fill `backend/.env` with required provider keys and `PINECONE_API_KEY`.

3. Start the backend (from `backend/` dir):

   ```bash
   # create venv, install requirements, then
   uvicorn api.main:app --host 0.0.0.0 --port 8000
   ```

4. Start the frontend (from `gitlink/` dir):

   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000` and paste a repository URL.

## Environment variables (important)

- Frontend (`gitlink/.env.local`)
  - `NEXT_PUBLIC_API_URL` — full URL of your backend (e.g. `https://your-backend.onrender.com`)

- Backend (`backend/.env`)
  - `PINECONE_API_KEY` — required (used at import time)
  - `OPENAI_API_KEY` or `GEMINI_API_KEY` — optional; if not set the user must paste a provider key in the UI
  - `REDIS_URL` — if you use the background job queue
  - `ALLOWED_ORIGINS` — comma-separated frontend origin(s) (exact origin, no trailing slash)

See `backend/.env.example` for the full list.

## Deployment notes

- Frontend (Vercel)
  - Deploy the `gitlink/` directory on Vercel
  - Add Environment Variable `NEXT_PUBLIC_API_URL` pointing to your backend
  - Redeploy after changing env vars

- Backend (Render / Docker)
  - Prefer running via Docker with `python:3.11-slim` (this repo includes a `backend/Dockerfile` to pin Python)
  - If using Render buildpacks, set the service Root Directory to `backend/` and use the provided `render-build.sh` or pin Python with `runtime.txt`
  - Set `ALLOWED_ORIGINS` to your frontend origin (no trailing slash). Example:
    - `ALLOWED_ORIGINS=https://git-repo-3y79.vercel.app`

## Common troubleshooting

- "Could not reach the backend":
  - Make sure `NEXT_PUBLIC_API_URL` in Vercel points to the backend URL
  - Confirm the backend service is running and responding to `/health` or `/status`
  - Check browser console network requests and server logs

- `pydantic-core` / wheel build errors on Render:
  - These are usually caused by the build environment using a Python version without prebuilt wheels. Pin Python to 3.11 (use `backend/runtime.txt`) or deploy via Docker.

- CORS errors:
  - Ensure `ALLOWED_ORIGINS` contains your exact frontend origin (no trailing slash). After changing, redeploy backend.

- New API key not used / "too many api keys":
  - The UI stores the last-used key in browser `localStorage` under `repochat_ai_settings` — clear site data or open an incognito window and paste the new key
  - Provider dashboards may also report limits; delete unused keys there if provider blocks creation

## Healthcheck

Add a simple healthcheck endpoint (the backend already exposes status endpoints) and test with:

```bash
curl -i $NEXT_PUBLIC_API_URL/health
```

## Contributing

- Keep UI-only changes in `gitlink/` and avoid changing backend business logic unless necessary.
- Run linters and tests (if added) before opening PRs.

## License

MIT
