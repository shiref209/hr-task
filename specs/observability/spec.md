# Spec: Structured logging & health check

Status: **approved 2026-10-09**. Depends on: `api-foundation`, `auth`.

## Objective
Operators can see what the API is doing (JSON logs, one line per request, key auth events) and whether it can serve traffic (`GET /health`), without logs ever containing secrets, pay data or personal data.

## Decisions (2026-10-09)
- `nestjs-pino` (+ `pino-http`); `pino-pretty` as a dev-only dependency for readable local output (`NODE_ENV !== 'production'`). Nest's own logger is routed through pino.
- **Never logged:** auth secrets (cookies, `Set-Cookie`, `Authorization`, passwords, password hashes, refresh tokens/hashes), pay data (salaries, allowances, deductions, payslip amounts), personal data (emails, phone numbers). Request and response **bodies and headers are never logged**; query strings are dropped from logged URLs (search terms can be names).
- No request ids.
- `GET /health` — small controller, no `@nestjs/terminus`; one `SELECT 1` with a short timeout.

## Behaviour
**Request log** (pino-http, `info`): `{ level, time, msg: 'request completed', req: { method, path (no query) }, res: { status }, durationMs, userId? }` — `userId` only when the access token was valid. 5xx at `error`, 4xx at `warn`. `/health` and `/docs*` are not request-logged.

**Auth events** (`info`/`warn`, user id only — never email): `auth.login.succeeded {userId}`, `auth.login.failed` (no identifier at all), `auth.login.rate_limited` (no identifier), `auth.refresh.reuse_detected {userId}` (`warn`), `auth.logout {userId}`.

**Errors:** the global filter logs 5xx with the error *name*, *message* and stack — except Prisma errors, which log only `code`, `model` and `meta.target` (their messages embed query arguments such as `baseSalary` or `passwordHash`). 4xx are not logged by the filter (the request log already records them).

**Config:** `LOG_LEVEL` (`fatal|error|warn|info|debug|trace`, default `info`, validated in `envSchema`).

**Health:** `GET /health`, public (no auth, GET so no CSRF), not rate-limited, documented in Swagger.
- DB reachable within 1 s → `200 { status: 'ok', database: 'up' }`.
- DB error or timeout → `503 { status: 'error', database: 'down' }` — no error details.
- Plain JSON (not the `{ data }` envelope and not Problem Details): orchestrators and uptime checks read it directly.

## Implementation contract
- `apps/api/src/logging/`: `logging.module.ts` (`LoggerModule.forRootAsync` from nestjs-pino), `redaction.ts` (pino `redact` paths + a `serializers.req/res` that keep only method/path/status), `auth-events.ts` (`logAuthEvent(logger, event, fields)` typed by event name).
- `apps/api/src/health/`: `health.controller.ts`, `health.module.ts`, `database-health.ts` (`DatabaseHealth` interface + token `DATABASE_HEALTH`, Prisma impl `SELECT 1` with timeout) so tests can fake it.
- `main.ts`: `NestFactory.create(AppModule, { bufferLogs: true })` + `app.useLogger(app.get(Logger))`.

## Edge cases (approved 2026-10-09)
1. A request with cookies, an `Authorization` header and a JSON body → its log line contains none of them (asserted on captured log output).
2. `GET /employees?search=Mona` → logged `path` is `/employees` (no query).
3. Failed login for `test@hr.com` → log contains `auth.login.failed` and no email anywhere; successful login logs only the user id.
4. Refresh-token reuse → one `warn` `auth.refresh.reuse_detected` with the user id.
5. A Prisma error carrying `baseSalary` / `passwordHash` in its message → the error log has `code`/`model`/`target` only; the client still gets the generic 500.
6. An unexpected non-Prisma 500 → error log with name, message and stack; the client response is unchanged.
7. `/health` with the DB up → 200 body; DB throwing → 503; DB slower than 1 s → 503 within ~1 s (fake clock/timer in tests).
8. `/health` without cookies works; it is never rate-limited and never request-logged.
9. Invalid `LOG_LEVEL` → the API refuses to start (envSchema).
10. Production (`NODE_ENV=production`) logs are single-line JSON; dev uses pino-pretty.
