# Authentication & authorization

[← Docs index](README.md) · spec: [`specs/auth/spec.md`](../specs/auth/spec.md)

## Goals
Only signed-in users reach the app. **HR** (admin) can do everything. An **EMPLOYEE** can browse colleagues without seeing any pay data, and can see only their own payslip and the tax table applied to them. **Authorization is enforced by the API**; the web UI only hides what the user can't use.

## Users and roles
- `users(id, email unique, passwordHash, employeeId unique)` — one login per employee.
- The **role is the linked employee's `type`** (`HR` / `EMPLOYEE`). One source of truth: the existing "last active HR can't be deleted/demoted" rule therefore also protects admin access.

## Passwords
Never stored. Only a salted hash with Node's built-in `crypto.scrypt` (no dependency): random 16-byte salt per user, constant-time comparison, stored as `scrypt$N$r$p$salt$hash`.

## Tokens and cookies
| | Access token | Refresh token |
|---|---|---|
| Format | JWT HS256 (`JWT_ACCESS_SECRET`), claims `sub`, `employeeId`, `role` | opaque random 32 bytes (not a JWT) |
| Lifetime | 15 minutes | 7 days |
| Cookie | `access_token`, `Path=/` | `refresh_token`, `Path=/auth` |
| Stored server-side | no | only as a **SHA-256 hash**, one row per device/login |

Both cookies are `httpOnly` (JavaScript can't read them, so XSS can't steal them), `SameSite=Strict`, and `Secure` in production.

- **Rotation:** every `POST /auth/refresh` revokes the presented token and issues a new pair.
- **Reuse detection:** presenting an already-rotated token revokes **all** of that user's sessions (rotated rows are kept as revoked until they expire, so reuse can be attributed).
- **Logout** removes only the current session; other devices stay signed in.
- Deactivating, deleting or changing an employee's type takes effect at the next refresh at the latest (≤ 15 minutes) — and **immediately** on HR-only routes (see hardening).

## Hardening (security review, 2026-10-09)
- **Atomic rotation:** a refresh token can only be revoked once; the losing request of two concurrent refreshes counts as reuse → all sessions revoked, 401. No grace window.
- **Absolute session lifetime 30 days** from sign-in, carried through rotation; past that, refresh fails and cookies are cleared. Expired rows are purged on login; revoked rows are kept until they expire so a replayed stolen token is still detected.
- **HR routes re-check the database:** on `@Roles('HR')` routes the guard re-reads the user (one indexed query) → 401 if the employee is now inactive/deleted, 403 if no longer HR.
- **Login rate limits** (`@nestjs/throttler`, only on `POST /auth/login`), three counters per attempt → 429 `/problems/too-many-requests` with `Retry-After`:
  - per **IP + email**: 5 / minute (`LOGIN_RATE_LIMIT_PER_MINUTE`) — guessing one account from one place;
  - per **IP**: 20 / minute (`LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE`) — spraying a password across many accounts;
  - per **email**: 30 / 15 minutes across all IPs (`LOGIN_RATE_LIMIT_PER_EMAIL`) — distributed guessing on one account.
  - IPv6 addresses are bucketed by their /64 (and IPv4-mapped equals plain IPv4), so rotating addresses can't dodge the limit.
- **Secrets:** `.env.example` ships an empty `JWT_ACCESS_SECRET`; the API refuses to start with an empty, short (< 32 chars) or placeholder secret.
- **Production defaults:** Swagger is off when `NODE_ENV=production` unless explicitly enabled; `WEB_ORIGIN` must be a valid URL.
- A failed refresh always clears both cookies.

## CSRF
`SameSite=Strict` plus a required `X-Requested-With: hr-payroll` header on every non-GET request (a cross-site form can't set custom headers). Missing header → 403 Problem Details. CORS allows credentials from `WEB_ORIGIN` only.

## Endpoints
| Method & path | Result |
|---|---|
| `POST /auth/login` | 200 `{ data: { user } }`, sets both cookies. Any failure → 401 "Invalid email or password" |
| `POST /auth/refresh` | 200 `{ user }`, rotates both cookies |
| `POST /auth/logout` | 204, clears cookies (idempotent) |
| `GET /auth/me` | 200 `{ user: AuthUser }` — `{ id, email, role, employee: { id, fullName } }` |
| `GET /me/tax-table` | 200 the table applied to the caller (override or default) |

Login gives the **same 401** for unknown email, wrong password, or an inactive/deleted employee, and verifies a dummy hash for unknown emails so response time doesn't reveal which (no account enumeration).

## How it's enforced (API)
- `JwtAuthGuard` is a **global** guard: every route requires a valid `access_token` unless marked `@Public()`. It attaches `AuthPrincipal { userId, employeeId, role }`.
- `RolesGuard` + `@Roles('HR')` restricts routes by role; `@CurrentUser()` gives handlers the principal.
- Ownership checks (an EMPLOYEE may read only their own payslip) are service rules that throw `ForbiddenError`.
- For an EMPLOYEE the employees controller serialises `EmployeeSummary` (no `baseSalary`, no `taxTable`), so salary never leaves the server.

## Permission matrix
| Endpoint | HR | EMPLOYEE |
|---|---|---|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | public | public |
| `GET /auth/me` | ✓ | ✓ |
| `GET /employees`, `GET /employees/:id` | ✓ full | ✓ without pay fields; `deleted=true` → 403 |
| `GET /departments` | ✓ | ✓ |
| `POST / PATCH / DELETE /employees…`, restore, profile image | ✓ | 403 |
| `GET / PUT /employees/:id/pay-items` | ✓ | 403 |
| `GET /employees/:id/payslip` | ✓ any | ✓ own only, else 403 |
| `GET /me/tax-table` | ✓ | ✓ |
| `/tax-tables/*`, `/payroll-settings/*` | ✓ | 403 |

Every row is covered by an e2e test (401 without a token, 403 for the wrong role).

## Web
Code in `apps/web/src/features/auth/` and `features/my-pay/`; edge cases 16–23 in [`specs/auth/spec.md`](../specs/auth/spec.md).
- `/login` page; every other route requires a session and the app boots by calling `/auth/me`.
- On a 401 the axios client calls `/auth/refresh` **once** (a single in-flight refresh shared by concurrent requests) and retries; if refresh fails it sends the user to `/login?next=<path>` (only same-origin relative paths are honoured).
- Every non-GET request sends `X-Requested-With: hr-payroll`; axios uses `withCredentials: true`.
- A 429 on login shows "Too many sign-in attempts. Try again in a minute." inline; signed-in users visiting `/login` go to `/employees`.
- Sign out clears the TanStack Query cache so no data from the previous user remains.
- Route guards: `RequireAuth` (no session → `/login?next=`) and `RequireHr` (EMPLOYEE on `/settings/*` → "You don't have access").
- Sidebar shows the user's name and role with a **Sign out** menu; HR sees Employees + Settings, EMPLOYEE sees Employees + My pay.
- EMPLOYEE view: no Salary column, no New / Edit / Delete / Pay actions, no deleted filter; **"My pay"** (`/my-pay`) shows their own payslip with a month picker and the tax table applied to them.

## Known limitations
- No permanent account lockout. Accepted trade-off of the per-email limit: someone who knows an email can delay that user's new sign-ins for up to 15 minutes (existing sessions are unaffected).
- Strict reuse detection: two tabs refreshing at the same instant sign the user out everywhere.
- Non-HR routes keep up to a 15-minute window after an employee is deactivated (until the access token expires).
