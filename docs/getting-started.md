# Getting started

[← Docs index](README.md)

## Prerequisites
| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 22.12 (see `.nvmrc`) | Node's `--env-file` loads `.env`, so no `dotenv` |
| pnpm | 10 (`packageManager` pins 10.18.0) | `corepack enable` installs it |
| Docker | any recent | only runs PostgreSQL 17 |

## Before you start (local run): database and credentials
**→ [Local setup: database & environment credentials](database-and-env.md)** — how to fill `.env` (you choose the Postgres user, password and database; generate the JWT secret), start PostgreSQL in Docker, and fix common connection problems.

## Run it — in this order
```bash
# 1. Install all workspaces (also runs `prisma generate` for the API)
pnpm install

# 2. Create your env file, then fill it in (see database-and-env.md)
cp .env.example .env

# 3. Start PostgreSQL in Docker and wait for it to be healthy
docker compose up -d db

# 4. Create the schema (applies every migration in apps/api/prisma/migrations)
pnpm --filter api db:migrate

# 5. Load reference and demo data (idempotent: safe to run again)
pnpm --filter api db:seed

# 6. Build @hr/types, then run the types watcher + API + web together
pnpm dev
```

| What | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:3000 |
| Swagger UI (see [API docs](api-docs.md)) | http://localhost:3000/docs (raw JSON at `/docs-json`) |
| Design-system preview (dev only, see [Design system](design-system.md)) | http://localhost:5173/design-system |

> **Port 5432 already in use?** A Postgres installed on your machine shadows the container (`P1010 User was denied access`). Stop it (`brew services stop postgresql`) or change `POSTGRES_PORT` and `DATABASE_URL` in `.env`.

## Environment variables (`.env`)
| Variable | Purpose |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Docker Postgres container |
| `DATABASE_URL` | Prisma connection string (must match the values above) |
| `API_PORT` | API port (default 3000) |
| `UPLOADS_DIR` | where profile images are stored (gitignored) |
| `SWAGGER_ENABLED` | serve `/docs` (default: on, except in production) |
| `WEB_ORIGIN` | the only origin CORS allows (the web dev server) |
| `TZ` | local date for "hire date can't be in the future" (`Africa/Cairo`) |
| `JWT_ACCESS_SECRET` | signs access tokens. **Empty in `.env.example` — the API refuses to start** until you set ≥ 32 random chars: `openssl rand -base64 48` (see [Authentication](authentication.md)) |
| `LOGIN_RATE_LIMIT_PER_MINUTE` · `LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE` · `LOGIN_RATE_LIMIT_PER_EMAIL` | optional login limits: per IP + email / minute (5), per IP / minute (20), per email / 15 min (30) |
| `NODE_ENV` | `production` turns on `Secure` cookies and turns Swagger off by default |

The web app reads `VITE_API_URL` (default `http://localhost:3000`, see `apps/web/.env.example`).

## Demo data and accounts
The seed creates six departments, a default tax table **"Standard"** (≤ 10,000 @ 0% · ≤ 20,000 @ 10% · above @ 15%), social insurance 11% capped at 2,000, and a set of employees with allowances and deductions.

Login accounts:

| Email | Password | Role |
|---|---|---|
| `test@hr.com` | `test@123` | HR (admin) |
| `test@employee.com` | `test@123` | EMPLOYEE |

## Test the flow end to end
1. Sign in at http://localhost:5173/login as `test@hr.com` → **Employees**. Search by name or email, filter by department / status / type, page through the list.
2. **New employee** → fill the form. Try an invalid email, a future hire date or a salary with 3 decimals: the same Zod rules run in the browser and on the API.
3. Open the employee's drawer → **Pay** tab: add allowances and deductions, optionally assign a tax table.
4. Row menu → **Payslip** → pick a month. Check gross, the per-bracket tax lines, the effective rate, insurance (and whether it was capped), applied/unapplied deductions and net.
5. **Settings → Tax tables**: create a table, change the default, try deleting a table that is in use (409). **Settings → Social insurance**: change the rate or cap and re-open the payslip.
6. Delete an employee (soft) and restore it from the "deleted" filter.
7. Sign out (user menu in the sidebar) and sign in as `test@employee.com`: the Salary column and write actions are gone, **Settings** is replaced by **My pay** (your own payslip and applied tax table), and `/settings/tax-tables` shows "You don't have access".
8. Optional: enter a wrong password 6 times in a minute to see the rate-limit message.

Prefer the API directly? Use Swagger UI at http://localhost:3000/docs.

## Scripts (run from the repo root)
| Command | Does |
|---|---|
| `pnpm dev` | builds `@hr/types`, then runs types watcher + API + web in parallel |
| `pnpm test` | all unit tests (types, API, web) |
| `pnpm --filter api test:e2e` | API end-to-end tests over HTTP (in-memory fakes, no database) |
| `pnpm typecheck` | TypeScript across every package |
| `pnpm lint` | ESLint (API) and oxlint (web) |
| `pnpm build` | production build of every package |
| `pnpm --filter api db:migrate` | apply migrations |
| `pnpm --filter api db:seed` | load seed data |
| `pnpm --filter api docs:export` | regenerate `docs/openapi.json` (no database needed) |

Per package: `pnpm --filter api|web|types <script>`.

To run exactly what CI runs, see [Continuous integration](ci.md#run-the-same-checks-locally).
