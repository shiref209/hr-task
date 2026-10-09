# Local setup: database (Docker / PostgreSQL) & environment credentials

[← Getting started](getting-started.md) · [Docs index](README.md)

## 1. Get the credentials
This is for running the project **locally**. No credentials are handed out: **you choose them** for your machine. The only file involved is the gitignored `.env` at the repo root (never commit it).

```bash
cp .env.example .env
```

Then fill in or change these values:

| Variable | What to put | Example |
|---|---|---|
| `POSTGRES_USER` | any database user name | `hr` |
| `POSTGRES_PASSWORD` | any password for that user | `change-me` (fine locally) |
| `POSTGRES_DB` | database name | `hr_payroll` |
| `POSTGRES_PORT` | port on your machine for Postgres | `5432` (use e.g. `5433` if taken) |
| `DATABASE_URL` | built from the four values above | `postgresql://hr:change-me@localhost:5432/hr_payroll?schema=public` |
| `JWT_ACCESS_SECRET` | random string, ≥ 32 chars — **ships empty, the API won't start without it** | output of the command below |

Generate the JWT secret and paste it into `.env`:
```bash
openssl rand -base64 48
# or, without openssl:
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

`DATABASE_URL` format — every part must match the `POSTGRES_*` values:
```
postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:<POSTGRES_PORT>/<POSTGRES_DB>?schema=public
```
If the password has special characters (`@ : / ? #`), URL-encode them in `DATABASE_URL` (e.g. `@` → `%40`).

The remaining variables (`API_PORT`, `WEB_ORIGIN`, `TZ`, …) work as they are; see [Environment variables](getting-started.md#environment-variables-env). The web app's `apps/web/.env.example` (`VITE_API_URL`) only needs copying if the API is not on `http://localhost:3000`.

## 2. Start PostgreSQL with Docker
Requires Docker Desktop (or Docker Engine + Compose) running.

```bash
docker compose up -d db      # PostgreSQL 17, reads POSTGRES_* from .env
docker compose ps            # wait until db shows "healthy"
```

- On **first start** the container creates the user, password and database from `.env`. Data is kept in the `db-data` volume across restarts.
- Connect manually if you want to look around:
  ```bash
  docker compose exec db psql -U hr -d hr_payroll
  ```

Then create the schema and demo data:
```bash
pnpm --filter api db:migrate   # apply migrations
pnpm --filter api db:seed      # departments, tax table, settings, demo employees and logins
```

## Common problems
| Symptom | Cause | Fix |
|---|---|---|
| `P1010 User was denied access` or wrong-password errors | A Postgres installed on your machine already listens on 5432, so the API talks to it instead of the container | Stop it (`brew services stop postgresql`) or set `POSTGRES_PORT=5433` and the same port in `DATABASE_URL`, then `docker compose up -d db` |
| Changed `POSTGRES_USER` / `PASSWORD` / `DB` but login still fails | They are only applied when the volume is first created | Reset the database: `docker compose down -v && docker compose up -d db`, then migrate and seed again (**deletes all local data**) |
| `P1001 Can't reach database server` | Container not running or not healthy yet | `docker compose ps`, `docker compose logs db` |
| API exits with `JWT_ACCESS_SECRET` error | Secret empty, shorter than 32 chars or still a placeholder | Generate one (see above) |

## Without Docker
Any PostgreSQL 15+ works: create a user and database yourself, point `DATABASE_URL` at it, then run `db:migrate` and `db:seed`. The `POSTGRES_*` variables are only used by Docker.

## Stop / reset
```bash
docker compose stop            # stop, keep data
docker compose down            # remove the container, keep data
docker compose down -v         # remove container and data (fresh start)
```
