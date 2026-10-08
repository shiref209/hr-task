# Spec: API Foundation — response envelope & global error handling

Status: **awaiting edge-case sign-off**

## Objective
Every API response has one predictable shape, defined once in `types/` and consumed by both the API and the web app:
- **Success** → `ApiResponse<T>`: `{ data: T, meta?: PaginationMeta }`
- **Error** → RFC 7807 `ProblemDetails` with `Content-Type: application/problem+json`

Handlers never build these shapes by hand and never `try/catch`: a global interceptor wraps successes, a global exception filter maps every thrown error.

## Shared contract (`types/src/common/`)
```ts
interface ApiResponse<T> { data: T; meta?: PaginationMeta }
interface PaginationMeta { page: number; pageSize: number; totalItems: number; totalPages: number }
interface ProblemDetails {
  type: string;            // URI identifying the problem kind, e.g. "/problems/validation-error"
  title: string;           // short, stable summary for the kind
  status: number;          // HTTP status, duplicated in the body
  detail?: string;         // human-readable, safe to show users
  instance?: string;       // request path
  errors?: Record<string, string[]>; // field path → messages (validation only)
}
```
Also exported: `paginationQuerySchema` (Zod) for `page` / `pageSize`.

## Behaviour
**Success (global interceptor)**
- Handler returns a value → body is `{ data: value }`.
- Handler returns a `PaginatedResult` → body is `{ data: items, meta }`.
- Handler returns nothing (e.g. DELETE) → `204 No Content`, empty body.

**Errors (global filter)**: domain errors are framework-free classes in `apps/api/src/common/errors/`; features extend them.

| Thrown | Status | `type` |
|---|---|---|
| Zod validation failure (body, query, params) | 400 | `/problems/validation-error` + `errors` map |
| Malformed JSON body | 400 | `/problems/malformed-request` |
| `NotFoundError` / unknown route | 404 | `/problems/not-found` |
| `ConflictError` (e.g. duplicate email) | 409 | `/problems/conflict` |
| Payload too large (uploads) | 413 | `/problems/payload-too-large` |
| Unsupported media type (uploads) | 415 | `/problems/unsupported-media-type` |
| `BusinessRuleError` | 422 | `/problems/business-rule-violation` |
| Other Nest `HttpException` | its status | `about:blank` |
| Anything else | 500 | `about:blank`, generic detail; stack logged, never returned |

Unique-constraint races from Prisma are translated to `ConflictError` inside the repository (infrastructure), not in the filter.

## Project structure
```
types/src/common/          api-response.ts, problem-details.ts, pagination.ts
apps/api/src/common/
  errors/                  domain-error.ts (base + NotFound/Conflict/BusinessRule)
  http/                    problem-details.filter.ts, response-envelope.interceptor.ts,
                           zod-validation.pipe.ts, paginated-result.ts
```

## Testing strategy (Jest, no DB/network)
- Filter: one unit test per row of the table above (status, `type`, content type, `errors` map, no stack leak on 500).
- Interceptor: plain value, `PaginatedResult`, `undefined` → 204.
- Zod pipe: nested field paths flattened to `"a.b"` keys; multiple messages per field.
- One e2e (Supertest) proving the filter + interceptor are registered globally.

## Edge cases (proposed — confirm)
1. Validation errors report **all** failing fields at once, not just the first.
2. Unknown body properties are **rejected** (400), not silently stripped.
3. 500 responses never include the error message or stack; they're logged instead.
4. Field paths for nested/array fields use dot notation: `allowances.0.amount`.

## Boundaries
- Always: throw domain errors from domain/application code; let the filter map them.
- Ask first: adding new problem `type`s beyond the table.
- Never: `try/catch` in controllers; return raw Prisma errors; leak stacks.

## Success criteria
- Every endpoint returns `ApiResponse<T>` or `ProblemDetails`, verified by tests.
- The web http client can type responses with the same `types/` imports.
