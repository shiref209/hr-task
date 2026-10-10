# Logging & health check

> Built in an extra hour after the 6–8 hour assessment window (see the note at the top of the [README](../README.md)).

## What gets logged

Logs come from [`nestjs-pino`](https://github.com/iamolegga/nestjs-pino) (pino + pino-http). Nest's own logger is routed through pino.

| Event | Level | Fields |
|---|---|---|
| `request completed` | `info` (4xx → `warn`, 5xx → `error`) | `req: { method, path }` (no query string), `res: { status }`, `durationMs`, `userId` when signed in |
| `auth.login.succeeded` | `info` | `userId` |
| `auth.login.failed` | `info` | none — no email, no user id |
| `auth.login.rate_limited` | `info` | none |
| `auth.logout` | `info` | `userId` |
| `auth.refresh.reuse_detected` | `warn` | `userId` (all of that user's sessions are revoked) |
| unexpected error (5xx) | `error` | error name, message, stack — Prisma errors log only `code`, `model`, `target` |

**Never logged:** request/response bodies and headers, cookies, `Set-Cookie`, `Authorization`, query strings (search terms can be names), passwords and hashes, refresh tokens, emails, phone numbers, salaries and payslip amounts.

`/health` and `/docs*` are not request-logged.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `LOG_LEVEL` | `info` | `fatal` · `error` · `warn` · `info` · `debug` · `trace`; an invalid value stops the API at startup |
| `NODE_ENV` | — | `production` → one-line JSON per event; anything else → readable output via `pino-pretty` |

## Health check

`GET /health` is public (no sign-in), never rate-limited and returns plain JSON (no `{ data }` envelope) so uptime checks and orchestrators can read it directly.

| Database | Status | Body |
|---|---|---|
| answers `SELECT 1` within 1 s | `200` | `{ "status": "ok", "database": "up" }` |
| errors or takes longer than 1 s | `503` | `{ "status": "error", "database": "down" }` |

## Try it in development

Start the API (it loads the root `.env`):
```bash
pnpm dev            # or: pnpm --filter api dev
```

Health check:
```bash
curl localhost:3000/health
# {"status":"ok","database":"up"}           200 — nothing is logged
docker compose stop db && curl -i localhost:3000/health
# {"status":"error","database":"down"}      503 within ~1 s
docker compose start db
```

Request log and sign-in events:
```bash
curl -s -c /tmp/c -H 'X-Requested-With: hr-payroll' -H 'Content-Type: application/json' \
  -d '{"email":"test@hr.com","password":"test@123"}' localhost:3000/auth/login >/dev/null
curl -s -b /tmp/c 'localhost:3000/employees?search=Mona' >/dev/null
```
Output (timestamps and process id trimmed):
```
INFO: auth.login.succeeded
    req: { "method": "POST", "path": "/auth/login" }
    userId: "34ca8973-…"
INFO: request completed
    req: { "method": "GET", "path": "/employees" }
    userId: "34ca8973-…"
    res: { "status": 200 }
    durationMs: 11
```
Note the logged path has no `?search=Mona`, and no cookie or email appears anywhere.

Failed sign-ins and the rate limit:
```bash
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -H 'X-Requested-With: hr-payroll' \
  -H 'Content-Type: application/json' -d '{"email":"test@hr.com","password":"wrong"}' localhost:3000/auth/login; done
```
Prints `401` five times then `429`; the log shows five `auth.login.failed` lines (no email) and one `auth.login.rate_limited`. This blocks new sign-ins for `test@hr.com` for about a minute.

For production-style output run the built API with `NODE_ENV=production` — same fields, one JSON line per event.

## Tests

```bash
pnpm --filter api test -- logging health error-details config auth.service
pnpm --filter api exec jest --config ./test/jest-e2e.json test/health.e2e-spec.ts
```
They capture real log output and assert it contains no cookies, query strings or emails, check the auth events and Prisma error redaction, and cover `/health` returning 200, 503 on error and 503 on a slow database.
