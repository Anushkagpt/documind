# DocuMind - Ask your documents anything

A full-stack RAG (retrieval-augmented generation) app. Upload text, Markdown, or
PDF documents; DocuMind chunks them, embeds every chunk, and answers questions
with cited sources.

![Stack](https://img.shields.io/badge/stack-React%20%C2%B7%20Node%20%C2%B7%20Postgres%20%C2%B7%20Redis-7c6cf5)
[![Netlify Status](https://api.netlify.com/api/v1/badges/088c1b44-f95d-4527-91d6-2b5ae44e8fac/deploy-status)](https://app.netlify.com/projects/documind-code/deploys)

## Features

- **RAG pipeline**: paragraph-aware chunking with overlap, embedding per chunk,
  cosine-similarity retrieval, grounded answers with inline `[n]` citations
- **Two AI providers, one interface**
  - `GEMINI_API_KEY` set: Google Gemini (`gemini-embedding-001` + `gemini-2.5-flash`)
  - no key: deterministic hashed bag-of-words embedder + extractive answers, so
    the app - and the whole test suite - runs with zero external services
- **Async ingestion**: BullMQ queue + worker when `REDIS_URL` is set, inline
  processing otherwise
- **Postgres + Prisma** for users, documents, chunks, and query history, with an
  in-memory demo mode (`DEMO_MODE=true` or no `DATABASE_URL`)
- **JWT auth** (bcrypt password hashing), per-user document isolation
- **Uploads**: paste text or upload `.txt` / `.md` / `.pdf` (10 MB limit)

## Architecture

```
apps/web   React + TS + Vite  ->  /api (nginx or Vite proxy)
apps/server  Express + TS
              ├─ routes: auth / documents / ask
              ├─ ingestion: chunker -> embedder -> chunk store
              ├─ queue: BullMQ + Redis (optional, inline fallback)
              └─ store: Prisma/Postgres (prod) | in-memory (demo)
Postgres: users, documents, chunks (embedding float[]), query logs
Redis: ingestion queue
```

## Quickstart (demo mode - no services needed)

```bash
cd apps/server && npm install && npm run dev   # API on :4000, seeds demo data
cd apps/web && npm install && npm run dev      # UI on :5173
```

Log in with **demo@documind.dev / password123** - two sample documents are
already indexed, and search works offline.

## Full mode

```bash
docker compose up --build        # Postgres + Redis + API + web on :8080
```

Or bring your own services: set `DATABASE_URL` (e.g. Neon free tier) and
`REDIS_URL` (e.g. Upstash / Render Key Value) in `apps/server/.env`, then:

```bash
cd apps/server
npm install
npm run db:push && npm run db:seed
npm run dev
```

## Getting a free Gemini API key

1. Go to https://aistudio.google.com/apikey and sign in with a Google account
2. Click **Create API key** - no credit card required
3. Put it in `apps/server/.env` as `GEMINI_API_KEY=...`

The free tier covers `gemini-2.5-flash` and `gemini-embedding-001` at no
cost, with per-minute and daily rate limits that are plenty for a personal
demo - see https://ai.google.dev/gemini-api/docs/pricing and
https://ai.google.dev/gemini-api/docs/rate-limits for current limits. Re-index
after adding a key so chunks get real embeddings.

## Environment variables (apps/server/.env)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `4000` | API port |
| `DATABASE_URL` | full mode | - | Postgres connection string |
| `REDIS_URL` | no | - | BullMQ queue; inline processing if unset |
| `GEMINI_API_KEY` | no | - | Gemini answers + embeddings; local fallback if unset |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Answer model |
| `GEMINI_EMBEDDING_MODEL` | no | `gemini-embedding-001` | Embedding model |
| `JWT_SECRET` | yes (prod) | dev value | JWT signing secret |
| `WEB_ORIGIN` | no | `http://localhost:5173` | CORS origin(s), comma-separated |
| `DEMO_MODE` | no | auto | `true` forces the in-memory store |

## Scripts

- `npm run dev` / `npm start` - API (tsx)
- `npm test` - unit tests: chunker, local embedder, retrieval ranking (no key needed)
- `npm run db:push` / `npm run db:seed` - Prisma schema + demo data
- `npm run build` (web) - production frontend bundle

## Notes and next steps

- Embeddings are stored as `float[]` and ranked in JS - fine at demo scale. The
  upgrade path is pgvector (`CREATE EXTENSION vector`) with an index on the
  embedding column.
- The BullMQ worker runs in the API process; split it into its own service for
  production.
