# Spec: API Foundation — response envelope & global error handling

Status: **approved 2026-10-08**

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
- Handler returns nothing → no wrapping. DELETE handlers declare `@HttpCode(204)` (native Nest, explicit per route) → `204 No Content`, empty body.

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
| Any 5xx (`HttpException` ≥ 500 or unknown error) | its status / 500 | `about:blank`, generic detail; original message + stack logged, never returned |

Unique-constraint races from Prisma are translated to `ConflictError` inside the repository (infrastructure), not in the filter.

## Implementation contract (tests and code both follow these names)
`types/src/common/` (exported from `types/src/index.ts`):
- `api-response.ts` → `ApiResponse<T>`, `PaginationMeta`
- `problem-details.ts` → `ProblemDetails`, `ProblemType` const map (`validationError: '/problems/validation-error'`, `malformedRequest`, `notFound`, `conflict`, `payloadTooLarge`, `unsupportedMediaType`, `businessRuleViolation`)
- `pagination.ts` → `paginationQuerySchema` (`page` coerced int ≥ 1, default 1; `pageSize` coerced int 1–100, default 20), `PaginationQuery`

`apps/api/src/common/errors/domain-errors.ts` (no Nest imports):
`DomainError` (base, extends `Error`), `ValidationError(errors: Record<string,string[]>, message?)`, `NotFoundError`, `ConflictError`, `BusinessRuleError`, `MalformedRequestError`, `UnsupportedMediaTypeError`.

`apps/api/src/common/http/`:
- `zod-validation.pipe.ts` → `ZodValidationPipe(schema)`: returns `schema.parse` output (defaults/transforms applied); on failure throws `ValidationError` whose `errors` map is: issue path joined with `.` (`allowances.0.amount`); path-less issues under `_root`; each Zod `unrecognized_keys` issue becomes one entry **per key** (`errors.foo = ['Unknown field']`); a field can hold several messages.
- `error-details.filter.ts` → `ErrorDetailsFilter` (`@Catch()`, injects nothing; logs 5xx with Nest `Logger`). Mapping: domain errors by class; Nest `HttpException` by status (404 → notFound, 413 → payloadTooLarge, 415 → unsupportedMediaType, else `about:blank`); `MalformedRequestError` → malformedRequest; unknown → 500. `title` for `about:blank` = Node `http.STATUS_CODES[status]`. `instance` = request path without query string. Header `Content-Type: application/problem+json`.
- `response-envelope.interceptor.ts` → `ResponseEnvelopeInterceptor`: `PaginatedResult` → `{ data: items, meta }`; `undefined` → untouched; any other value → `{ data: value }`.
- `paginated-result.ts` → `class PaginatedResult<T> { constructor(items: T[], page: number, pageSize: number, totalItems: number) }` exposing `items` and `meta` (`totalPages = ceil(totalItems / pageSize)`, 0 when `totalItems` is 0).

- `json-parse-error.middleware.ts` → `jsonParseErrorMiddleware`: express error middleware turning body-parser's `entity.parse.failed` error into `MalformedRequestError`. Needed because Nest's `mapExternalException` rewrites the parser's `SyntaxError` into a plain `BadRequestException`, losing the marker before any filter sees it (decision recorded 2026-10-08; the filter-only approach was not possible).

`apps/api/src/configure-app.ts` → `configureApp(app: INestApplication)`: registers the JSON body parser early (so the middleware above sits behind it), the middleware, the global filter and the interceptor. Used by `main.ts` **and** e2e tests, so tests exercise the real wiring.

## Project structure
```
types/src/common/          api-response.ts, problem-details.ts, pagination.ts
apps/api/src/common/
  errors/                  domain-error.ts (base + NotFound/Conflict/BusinessRule)
  http/                    error-details.filter.ts, response-envelope.interceptor.ts,
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
