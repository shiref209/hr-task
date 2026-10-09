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
- Deactivating, deleting or changing an employee's type takes effect at the next refresh at the latest (≤ 15 minutes).

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
- `/login` page; every other route requires a session and the app boots by calling `/auth/me`.
- On a 401 the axios client calls `/auth/refresh` **once** (a single in-flight refresh shared by concurrent requests) and retries; if refresh fails it sends the user to `/login?next=<path>` (only same-origin relative paths are honoured).
- Sign out clears the TanStack Query cache so no data from the previous user remains.
- EMPLOYEE view: no Salary column, no New / Edit / Delete / Pay actions, a **"My pay"** page with their payslip and applied tax table; HR-only settings routes show "You don't have access".

## Known limitations
No login rate limiting / lockout yet. Two tabs refreshing at the same instant: the losing tab is sent to login.
