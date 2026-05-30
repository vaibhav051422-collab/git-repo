## Repo Layout

This workspace contains two deployable apps:

- `gitlink/` is the Next.js frontend.
- `backend/` is the FastAPI API.

## Local Setup

Copy the example env files and fill in real values:

```bash
cp .env.example .env
cp ../backend/.env.example ../backend/.env
```

For local development, start the frontend with `npm run dev` and the backend with Uvicorn from the `backend/` folder.

## Production Deploy

Deploy the frontend and backend separately.

Frontend:

- Host `gitlink/` on Vercel.
- Set `NEXT_PUBLIC_API_URL` to your live backend URL.

Backend:

- Host `backend/` on Render, Railway, Fly.io, or similar.
- Use `uvicorn api.main:app --host 0.0.0.0 --port $PORT` as the start command.
- Set `PINECONE_API_KEY`, `REDIS_URL`, and whichever AI key you want users to use.
- Set `ALLOWED_ORIGINS` to your frontend URL, for example `https://git-repo-3y79.vercel.app`.

## Runtime Behavior

The UI already sends the user-provided AI key with each request. If you want a server-key-only setup later, that would require removing the API key input flow from the frontend and updating the backend to read provider credentials from environment variables instead of request payloads.
