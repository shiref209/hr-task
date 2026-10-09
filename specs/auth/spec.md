# Spec: Authentication & authorization

Status: **approved 2026-10-09**. Depends on: `employees`, `payroll`, `payroll-web`.

## Objective
Only signed-in users reach the app. HR (admin) can do everything; an Employee can browse colleagues without seeing any pay data, and can see only their own payslip and the tax table applied to them. Authorization is enforced by the API; the UI only hides what the user can't use.

## Decisions (2026-10-09)
- **Passwords are never stored.** Only a salted hash: Node `crypto.scrypt` (built in, no dependency), random 16-byte salt per user, constant-time comparison. Stored as one string `scrypt$N$r$p$salt$hash`.
- **Users ↔ employees:** `users(id, email unique, passwordHash, employeeId unique FK)`. The **role is the linked employee's `type`** (`HR` / `EMPLOYEE`) — one source of truth; the existing last-HR guard therefore also protects admin access.
- **Access token:** JWT (HS256, `JWT_ACCESS_SECRET` from env), **15 minutes**, claims `sub` (user id), `employeeId`, `role`. Sent as an **httpOnly cookie** `access_token`.
- **Refresh token:** opaque random 32 bytes (not a JWT), **7 days**, httpOnly cookie `refresh_token` scoped to path `/auth`. **Stored only as a SHA-256 hash** in `refresh_tokens(id, userId, tokenHash unique, expiresAt, createdAt)` — one row per device/login.
- **Rotation:** every `POST /auth/refresh` deletes the presented token's row and issues a new access + refresh pair. **Reuse detection:** presenting a token that is unknown/already rotated but well-formed revokes **all** of that user's sessions if it can be attributed (see edge case 9) and returns 401.
- **Logout:** deletes the current session's refresh-token row and clears both cookies. No token is issued on logout; a new one is issued only when the user signs in again (confirmed 2026-10-09).
- **Cookies:** `httpOnly`, `SameSite=Strict`, `Secure` in production (`NODE_ENV=production`), `Path=/` for access, `Path=/auth` for refresh. Web and API run on localhost with different ports — same site, so Strict cookies flow; axios uses `withCredentials`, CORS allows credentials from `WEB_ORIGIN` only.
- **CSRF:** SameSite=Strict + the API only accepts JSON bodies (and multipart for the upload) and requires the `X-Requested-With: hr-payroll` header on every non-GET request — a cross-site form can't set it.
- **Seed:** `test@hr.com` (employee type HR) and `test@employee.com` (type EMPLOYEE), both password `test@123`, each linked to a seeded employee record with the same email. Passwords are hashed by the seed; the plaintext lives only in the README/seed as documented demo credentials.

## Permission matrix (enforced by guards on the API)
| Endpoint | HR | EMPLOYEE |
|---|---|---|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | public | public |
| `GET /auth/me` | ✓ | ✓ (own user + employee summary) |
| `GET /employees`, `GET /employees/:id` | ✓ full | ✓ **without pay fields** (`baseSalary`, `taxTable`) and without `deleted=true` |
| `GET /departments` | ✓ | ✓ |
| `POST/PATCH/DELETE /employees…`, restore, profile image | ✓ | 403 |
| `GET/PUT /employees/:id/pay-items` | ✓ | 403 |
| `GET /employees/:id/payslip` | ✓ any | ✓ **own id only**, else 403 |
| `GET /me/tax-table` | ✓ | ✓ — the table applied to them (override or default) |
| `/tax-tables/*`, `/payroll-settings/*` | ✓ | 403 |
| Swagger `/docs` | public (dev only, as today) | |

The employee-facing employee shape is a separate shared type `EmployeeSummary` (= `Employee` without `baseSalary`, `taxTable`); the API serialises by role so salary never leaves the server for an Employee.

## API
| Method & path | Success | Notes |
|---|---|---|
| `POST /auth/login` | 200 `{ data: { user } }` (standard envelope), sets both cookies | body `{ email, password }`; any failure → 401 "Invalid email or password" |
| `POST /auth/refresh` | 200 `{ user }`, rotates both cookies | no body; reads the refresh cookie |
| `POST /auth/logout` | 204, clears cookies | idempotent |
| `GET /auth/me` | 200 `{ user: AuthUser }` | |
| `GET /me/tax-table` | 200 `TaxTable` (without `employeeCount`) | |

## Web
- `/login` page (email, password, "Sign in"); every other route requires a session; the app boots by calling `/auth/me`.
- The axios client retries once after a 401 by calling `/auth/refresh` (single in-flight refresh shared by concurrent requests); if refresh fails → clear cached user, go to `/login?next=<path>`.
- Sidebar shows the user's name and role and a "Sign out" button; Settings links only for HR.
- Employee role: list without the Salary column and without New / Edit / Delete / Pay / restore; row menu offers nothing for others; a **"My pay"** page shows their own payslip (month picker) and their applied tax table.
- HR-only routes (`/settings/*`) render "You don't have access" for an Employee (the API also returns 403).

## Implementation contract (API)
- `types/src/auth/`: `loginSchema` `{ email, password }` (email trimmed + lowercased); `Role` = `'HR' | 'EMPLOYEE'`; `AuthUser` `{ id, email, role, employee: { id, fullName } }` (only what the web shell and "My pay" need). `types/src/employees`: `employeeSummarySchema` = `employeeSchema` without `baseSalary` and `taxTable`; `EmployeeSummary`.
- `apps/api/src/auth/` (flat module):
  - `password-hasher.ts`: `PasswordHasher { hash(plain): Promise<string>; verify(plain, stored): Promise<boolean> }`, token `PASSWORD_HASHER`; `ScryptPasswordHasher` (cost params injectable so tests can use cheap ones).
  - `users.repository.ts`: `UserRepository { findByEmail(email): Promise<UserAccount | null>; findById(id): Promise<UserAccount | null> }`, token `USER_REPOSITORY`; `UserAccount = { id, email, passwordHash, employee: { id, fullName, type, status, deletedAt } }`. `prisma-users.repository.ts`.
  - `refresh-tokens.repository.ts`: `RefreshTokenRepository { create({ userId, tokenHash, expiresAt }); findByHash(hash): Promise<{ id, userId, expiresAt, revokedAt } | null>; revoke(id); revokeAllForUser(userId); delete(id) }`, token `REFRESH_TOKEN_REPOSITORY`; Prisma impl. Rotated tokens are **revoked, not deleted**, until they expire (reuse detection).
  - `auth.service.ts`: `login(email, password)`, `refresh(rawRefreshToken)`, `logout(rawRefreshToken | undefined)`, `me(userId)`; injects the two repositories, `PASSWORD_HASHER`, `JwtService`, `CLOCK`. Returns `{ user: AuthUser, accessToken, refreshToken, refreshExpiresAt }` for login/refresh.
  - `auth.errors.ts`: `InvalidCredentialsError` (401), `SessionExpiredError` (401) — map to 401 in the global filter (new `UnauthorizedError` base in `common/errors`), plus `ForbiddenError` (403).
  - `auth-cookies.ts`: `setAuthCookies(res, tokens)`, `clearAuthCookies(res)` (names `access_token` path `/`, `refresh_token` path `/auth`, httpOnly, SameSite=Strict, Secure when `NODE_ENV=production`).
  - `jwt-auth.guard.ts` (global `APP_GUARD`, reads the `access_token` cookie, attaches `AuthPrincipal { userId, employeeId, role }`), `public.decorator.ts` (`@Public()`), `roles.guard.ts` + `roles.decorator.ts` (`@Roles('HR')`), `current-user.decorator.ts` (`@CurrentUser()` → `AuthPrincipal`).
  - `auth.controller.ts`: `/auth/login`, `/auth/refresh`, `/auth/logout` (`@Public()`), `/auth/me`.
- `common/http/csrf-header.middleware.ts`: non-GET/HEAD/OPTIONS requests without `X-Requested-With: hr-payroll` → 403 Problem Details; registered in `configureApp` (+ `cookie-parser`, CORS `credentials: true`).
- Config: `JWT_ACCESS_SECRET` (required, ≥ 32 chars) validated in `appConfig`; TTLs are constants (15 min / 7 days).
- Employees: controller serialises with `toEmployeeSummary` for `EMPLOYEE`; `deleted=true` and every write endpoint `@Roles('HR')`. Payroll: tax tables, social insurance, pay items `@Roles('HR')`; payslip: HR any, EMPLOYEE own `employeeId` only (`ForbiddenError`). `GET /me/tax-table` → `TaxTablesService.forEmployee(employeeId)` (override or default, without `employeeCount`).
- Test support: `apps/api/test/auth.ts` → `authCookie(role, { employeeId? })` signs a real access token with the test secret so existing e2e suites authenticate; fakes `InMemoryUserRepository`, `InMemoryRefreshTokenRepository`.

## Security review decisions (2026-10-09)
- **Rotation is atomic:** `revoke` only succeeds on a not-yet-revoked row (`updateMany … where revokedAt null`); the losing concurrent refresh is treated as reuse → all sessions revoked, 401.
- **Strict reuse, no grace window:** two tabs refreshing at the same instant force a re-login everywhere (documented limitation).
- **Immediate revocation for HR-only routes:** on routes marked `@Roles('HR')` the guard re-reads the user (one indexed query) and rejects with 401 if the employee is inactive/deleted, or 403 if no longer HR. Other routes keep the ≤ 15-minute window.
- **Absolute session lifetime 30 days:** `refresh_tokens.session_started_at` is carried through rotation; a refresh past 30 days from sign-in fails with 401 and clears cookies. Only **expired** rows of the user are purged on login — revoked rows are kept until they expire so a replay of a stolen, rotated token is still detected (corrected 2026-10-09 after the commit security review).
- **Login rate limit:** `@nestjs/throttler` on `POST /auth/login`: 5 attempts per minute per IP + email → 429 Problem Details (`/problems/too-many-requests`), with `Retry-After`.
- **Plus a per-IP limit:** 20 login attempts per minute per IP across all emails (`LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE`, default 20) so one IP can't spray a password across many accounts (added 2026-10-09 after the commit security review).
- **IP keys use `/64` for IPv6** (the throttler library's `normalizeIp`), so rotating addresses inside one IPv6 block can't dodge the limits; IPv4-mapped IPv6 equals the plain IPv4 address.
- **Per-account limit:** 30 sign-in attempts per 15 minutes per email across all IPs (`LOGIN_RATE_LIMIT_PER_EMAIL`, default 30). Trade-off accepted: someone who knows an email can block that user's new sign-ins until the window passes; existing sessions keep working. Requests without a string email skip this counter (they fail validation anyway).
- **Single process:** counters are in memory; with several API instances they'd multiply and reset on restart (upgrade path: a Redis throttler store). Never set Express `trust proxy` to `true` — use the exact proxy hop count, or `X-Forwarded-For` becomes spoofable.
- **Secrets:** `.env.example` ships an empty `JWT_ACCESS_SECRET`; the API refuses to start with an empty or placeholder secret; README tells how to generate one.
- **Failed refresh** always clears both cookies; an inactive/deleted user's presented token is revoked.
- **Production defaults:** Swagger off when `NODE_ENV=production` unless explicitly enabled; `WEB_ORIGIN` must be a URL.

## Web: decisions and contract (2026-10-09)
- **On 401:** the http client tries `POST /auth/refresh` once (one shared in-flight refresh per tab) and retries the original request; if the refresh also fails, it clears the session and redirects to `/login?next=<current path>`. Requests to `/auth/*` never trigger a refresh.
- Every non-GET request sends `X-Requested-With: hr-payroll`; axios uses `withCredentials: true`.
- `features/auth/`: `api/auth-api.ts` (`login`, `logout`, `fetchMe`, `fetchMyTaxTable`), `use-session.ts` (TanStack query on `/auth/me`; `null` when signed out), `pages/login-page.tsx` (`/login`: "Email", "Password", "Sign in"), `require-auth.tsx` (route guard → `/login?next=`), `require-hr.tsx` (renders "You don't have access" for EMPLOYEE).
- `features/my-pay/pages/my-pay-page.tsx` (`/my-pay`, EMPLOYEE): own payslip (reuses `PayslipView` + month picker) and "Your tax table" (applied brackets).
- Sidebar: user name + role, "Sign out"; HR sees Employees + Settings; EMPLOYEE sees Employees + My pay.
- Employees page for EMPLOYEE: no Salary column, no "New employee", row menu hidden (nothing actionable), no "Show deleted".
- `shared/http/http-client.ts` keeps `ApiError`/`toApiError`; the refresh logic lives in an axios response interceptor there, with the redirect injected (so tests can assert it without a real navigation).

### Web edge cases (approved with 16–18; details added 2026-10-09)
19. A 401 on a normal request → exactly one refresh call even if several requests fail at once; all of them retry after it succeeds.
20. Refresh fails → redirect to `/login?next=/current/path?query` and the query cache is cleared; `next` is ignored unless it is a same-origin relative path.
21. Signed-in users visiting `/login` are sent to `/employees`.
22. A 429 on login shows "Too many sign-in attempts. Try again in a minute." inline.
23. EMPLOYEE never sees salary UI (column, Pay tab, payslip menu) and `/settings/*` shows "You don't have access".

## Edge cases (approved 2026-10-09)
**Login**
1. Unknown email, wrong password, or a user whose employee is deleted or INACTIVE → the same 401 "Invalid email or password" (no account enumeration); the response time doesn't reveal which (a dummy hash is verified for unknown emails).
2. Email is trimmed and case-insensitive.
3. ~~No rate limiting~~ → login is rate-limited (see Security review decisions).

**Tokens**
4. Access token expired/missing/invalid signature → 401 Problem Details; web refreshes once and retries.
5. Refresh with a valid token → new pair, the old row is **revoked (kept until expiry for reuse detection)**, `user` returned.
6. Refresh token expired → 401, row deleted, cookies cleared.
7. Two tabs refreshing at the same moment: the web client shares one in-flight refresh per tab; across tabs the loser gets 401 and is sent to login (acceptable, documented).
8. Logout deletes only the current session; other devices stay signed in.
9. Reuse of a rotated refresh token → 401 and **all** sessions of that user are revoked (rotated tokens are kept as revoked rows until expiry so reuse can be attributed).
10. If the user's employee becomes INACTIVE, deleted, or changes type, it takes effect at the next refresh at the latest (≤ 15 minutes); refresh fails for inactive/deleted users.

**Authorization**
11. Every endpoint in the matrix returns 401 without a valid access token and 403 for the wrong role; tested per endpoint.
12. An Employee's `GET /employees` and `GET /employees/:id` never contain `baseSalary` or `taxTable` (asserted on the raw JSON), and `deleted=true` → 403.
13. An Employee requesting another employee's payslip → 403; their own → 200 (still subject to the payslip rules: inactive/before hire → 422).
14. `GET /me/tax-table` returns the override table if set, else the default.
15. HR demoting themselves to EMPLOYEE (if not the last HR) loses HR rights at the next token refresh.

**Web**
16. Visiting any page signed out → `/login?next=/that/page`; after login, go to `next` (only same-origin relative paths are honoured).
17. Login errors show inline (not a toast); the password field is cleared on failure; Sign in shows loading.
18. Sign out → `/login`, query cache cleared so no data from the previous user remains.
