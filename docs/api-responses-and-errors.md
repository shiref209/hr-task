# API responses & error handling

[← Docs index](README.md) · spec: [`specs/api-foundation/spec.md`](../specs/api-foundation/spec.md)

Every response has one predictable shape, defined once in `@hr/types` and used by both apps.

## Success: the envelope
```ts
interface ApiResponse<T> { data: T; meta?: PaginationMeta }
interface PaginationMeta { page: number; pageSize: number; totalItems: number; totalPages: number }
```
- A global `ResponseEnvelopeInterceptor` wraps whatever a handler returns: a value → `{ data }`; a `PaginatedResult` → `{ data: items, meta }`; nothing → no body (DELETE routes declare `@HttpCode(204)`).
- Controllers never build the envelope by hand.

```json
{ "data": [{ "id": "…", "fullName": "Hana Rashed", "baseSalary": "26000.00" }],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 } }
```

## Errors: RFC 7807 Problem Details
Every error is `Content-Type: application/problem+json`:
```ts
interface ProblemDetails {
  type: string;                        // e.g. "/problems/validation-error"
  title: string;                       // stable summary for the kind
  status: number;
  detail?: string;                     // human-readable, safe to show users
  instance?: string;                   // request path
  errors?: Record<string, string[]>;   // field path → messages (validation only)
}
```
```json
{ "type": "/problems/validation-error", "title": "Validation failed", "status": 400,
  "instance": "/employees",
  "errors": { "email": ["Enter a valid email address"], "brackets.1.upTo": ["Must be greater than the previous upper limit"] } }
```

### Global error handler (API)
Handlers and services **throw small domain errors** and contain **no `try/catch`**. One global `ErrorDetailsFilter` (`apps/api/src/common/http/error-details.filter.ts`) maps them:

| Thrown | Status | `type` |
|---|---|---|
| Zod validation failure (body, query, params) | 400 | `/problems/validation-error` + `errors` map |
| Malformed JSON body | 400 | `/problems/malformed-request` |
| `UnauthorizedError` (missing/expired token, bad credentials) | 401 | `/problems/unauthorized` |
| `ForbiddenError` (wrong role, someone else's payslip) / missing CSRF header | 403 | `/problems/forbidden` |
| `NotFoundError` / unknown route | 404 | `/problems/not-found` |
| `ConflictError` (duplicate email, table in use) | 409 | `/problems/conflict` |
| Upload too large | 413 | `/problems/payload-too-large` |
| Unsupported image type | 415 | `/problems/unsupported-media-type` |
| `BusinessRuleError` (last HR, inactive employee payslip, rate ceiling) | 422 | `/problems/business-rule-violation` |
| Other Nest `HttpException` | its status | `about:blank` |
| Anything else / any 5xx | 500 | `about:blank`, generic detail — message and stack are **logged, never returned** |

Details worth knowing:
- Domain errors live in `apps/api/src/common/errors/domain-errors.ts` with **no Nest imports**, so services and `domain/` code stay framework-free. Features extend them (e.g. `EmployeeNotFoundError extends NotFoundError`).
- Validation reports **all** failing fields at once. Nested paths use dot notation (`allowances.0.amount`); path-less issues go under `_root`.
- Prisma unique-constraint races are translated to `ConflictError` inside the Prisma repository, so the filter never sees a raw database error.
- Malformed JSON needs a tiny express middleware (`json-parse-error.middleware.ts`): Nest rewrites body-parser's error into a plain `BadRequestException` before any filter runs, losing the information.

## Web: one error path
`apps/web/src/shared/http/http-client.ts`:
- An axios response interceptor turns **every** non-2xx into an `ApiError` (`status` + the `ProblemDetails` body). No response (offline, CORS) → `ApiError` with status 0 "Network error"; a non-problem body → "Request failed". Components only ever deal with one error type.
- **Queries** that fail render `<ErrorView>` (`shared/ui/error-view`): the Problem Details `title` / `detail` and a Retry button — never the raw error object.
- **Forms** map errors back onto fields with `apiErrorToForm()`: 400 → each `errors[field]` under its input; 409 → the conflicting field (e.g. email "already exists"); 422 → a form-level message.
- **Mutations** report success and generic failures through toasts.
- TanStack Query retries a failed query once; window-focus refetching is off.

**Why RFC 7807:** a standard, self-describing error format; the `errors` map lets the web place server messages next to the right input; and having a single filter means a new error kind is one line in one place.
