# fizlabe — Finzla Category Limits API

Small full-stack feature that lets users create category limits and compare them against activity records.

- **Backend** (this repo): Node.js + Express + TypeScript + Postgres (`pg`).
- **Frontend**: React + Vite + Tailwind. Lives in the [`fInzla_test`](https://github.com/) repo.
- **Storage**: Postgres (local via Docker; hosted on Neon for deployment).

---

## Setup

### Prerequisites
- Node.js 20+
- Docker (for local Postgres) **or** any Postgres 14+ connection string

### 1. Install
```bash
npm install
cp .env.example .env
```

### 2. Start Postgres (local)
```bash
docker compose up -d db
```
This starts Postgres on `localhost:5432` with user/password/db all `finzla`. The default `DATABASE_URL` in `.env.example` already points here.

Alternatively, set `DATABASE_URL` in `.env` to any hosted Postgres (e.g. Neon: `postgres://USER:PASS@HOST/DB?sslmode=require`).

### 3. Run
```bash
npm run dev        # starts on http://localhost:4000
```
The server runs `schema.sql` on boot and seeds 3 sample categories + 9 activities the first time (so all three statuses are visible).

### 4. Test
```bash
npm test
```
Tests use `pg-mem` (in-process Postgres emulator) — no Docker required.

---

## API

Base URL: `http://localhost:4000`

### `GET /limits`
List all category limits.

```bash
curl http://localhost:4000/limits
```
```json
[
  {
    "id": "5f9b…",
    "name": "Food",
    "limitAmount": 50000,
    "period": "monthly",
    "createdAt": "2026-05-01T12:00:00.000Z"
  }
]
```

### `POST /limits`
Create a category limit.

Request:
```bash
curl -X POST http://localhost:4000/limits \
  -H 'Content-Type: application/json' \
  -d '{"name":"Utilities","limitAmount":10000}'
```
Response `201`:
```json
{ "id": "…", "name": "Utilities", "limitAmount": 10000, "period": "monthly", "createdAt": "…" }
```
Errors: `400` invalid body, `409` duplicate name.

### `GET /activities`
List activities, optionally filtered by category.

```bash
curl 'http://localhost:4000/activities?categoryId=<id>'
```
```json
[
  { "id": "…", "categoryId": "…", "amount": 8000, "description": "Groceries", "occurredAt": "2026-05-02T12:00:00.000Z" }
]
```

### `POST /activities`
Create an activity (used by tests; not required by the brief but exposed for convenience).

```bash
curl -X POST http://localhost:4000/activities \
  -H 'Content-Type: application/json' \
  -d '{"categoryId":"<id>","amount":2500,"description":"Lunch"}'
```

### `GET /limit-summary`
Per-category usage in the **current calendar month**, with status.

```bash
curl http://localhost:4000/limit-summary
```
```json
[
  {
    "categoryId": "…",
    "name": "Entertainment",
    "limitAmount": 15000,
    "period": "monthly",
    "usage": 20000,
    "percentage": 133.33,
    "status": "Exceeded"
  }
]
```

**Status thresholds**
- `percentage < 80` → `On Track`
- `80 ≤ percentage ≤ 100` → `Warning`
- `percentage > 100` → `Exceeded`

---

## Deployment

### Database — Neon (free)
1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (with `?sslmode=require`).

### Backend — Render (free)
1. Push this repo to GitHub.
2. On Render: **New → Web Service** → connect repo. (Or use the included `render.yaml` via **New → Blueprint**.)
3. Build command: `npm ci && npm run build` — Start command: `npm start`.
4. Env vars:
   - `DATABASE_URL` = Neon connection string
   - `CORS_ORIGIN` = your deployed frontend URL (e.g. `https://finzla-web.vercel.app`)
   - `NODE_VERSION` = `20`

### Frontend — Vercel
Deploy the `fInzla_test` repo as a Vite project. Set `VITE_API_URL` to the Render URL.

---

## Project notes (submission)

### Explanation
The product is a single-page app for tracking monthly category spend against per-category limits. The backend exposes a small REST surface (`/limits`, `/activities`, `/limit-summary`) over Postgres. The summary endpoint does the actual work: it groups activities by category for the current calendar month with a single SQL aggregate, computes `usage / limit` as a percentage, and maps that to `On Track | Warning | Exceeded` using a pure function in `src/lib/status.ts` — the same thresholds are documented in the API contract and exercised by a table-driven unit test. Validation lives at the boundary via zod, so route handlers only see well-typed input. Schema is bootstrapped from `schema.sql` on startup (idempotent `CREATE TABLE IF NOT EXISTS`), and sample data is seeded once if the `categories` table is empty, chosen so the first page load demonstrates all three statuses. Tests run against `pg-mem` (in-process Postgres emulator) so `npm test` needs no Docker and no network — keeping the iteration loop fast and CI cheap. The frontend is a deliberately small React + Vite + Tailwind app: a single screen with a create-limit form, a summary card list with progress bars colored by status, and a recent-activity table. Axios talks to the API via `VITE_API_URL`. The app refreshes summary, limits, and activities in parallel after every create. Cold-start on free hosting tiers is documented as the main known failure mode.

### Assumptions (3)
1. **Period is monthly only.** Usage is summed over the current calendar month per category. The schema keeps a `period` column for future-proofing but only `'monthly'` is supported in v1.
2. **Thresholds:** `<80%` On Track, `80–100%` Warning (inclusive on both ends), `>100%` Exceeded. The brief is ambiguous about the boundaries; documented and tested explicitly.
3. **Single-user, no auth.** Currency is informational (formatted as NGN client-side); no FX, no per-user scoping.

### Decisions (2)
1. **Postgres via `pg` + raw SQL, not an ORM.** The data model is two tables and one aggregate query; an ORM would add a dependency, a migration toolchain, and indirection for no benefit. Raw SQL also keeps the `/limit-summary` logic transparent — one query, easy to review. Trade-off: I write parameterised SQL by hand and watch for injection, which `pg` enforces via `$1` placeholders.
2. **`pg-mem` for tests instead of a real Postgres in CI.** Real Postgres in tests is the gold standard, but for a small API with no Postgres-specific features beyond `date_trunc` (which `pg-mem` handles), the in-process emulator gives ~instant test runs and zero infra. The integration test exercises the full Express stack via `supertest`, so route wiring, validation, and SQL are still covered.

### Rejected alternative (1)
**Next.js fullstack with API routes.** Tempting because it collapses to one deploy target, but it muddies the REST boundary the brief asks for (`GET /limits`, etc.) and locks the backend into Vercel's serverless model — which doesn't play nicely with a persistent `pg.Pool`. Kept frontend and backend as separate deployables so each can scale (or be replaced) independently.

### Failure scenario (1)
**Cold-start latency on free hosting.** Render's free web service sleeps after 15 minutes idle and takes ~30–50s to wake; Neon's free Postgres auto-suspends and adds ~1s to the first query after idle. Result: a reviewer hitting the deployed app cold sees a long blank load, may assume it's broken, and bounce. Mitigations: a small `/health` endpoint plus a keep-warm pinger (cron-job.org) for the review window; longer-term, move to a paid Render plan or to Fly.io machines, which suspend but wake in ~1s.

### Out of scope
Authentication, multi-user, multi-currency / FX, recurring activities, editing or deleting limits/activities, pagination, real-time updates, observability.

### What I would improve next
- Edit/delete endpoints for limits and activities, with optimistic UI on the frontend.
- A `period` field that actually does something (weekly/quarterly/yearly aggregates).
- Replace `pg-mem` in tests with Testcontainers Postgres for full fidelity.
- Add request logging (pino) and a structured error type instead of a generic 500.
- Frontend: add a "log activity" form and per-category drill-down view.
