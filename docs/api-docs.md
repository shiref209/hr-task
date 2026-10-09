# API docs (OpenAPI / Swagger)

[← Docs index](README.md) · spec: [`specs/api-docs/spec.md`](../specs/api-docs/spec.md)

Every endpoint is documented in OpenAPI 3, browsable in Swagger UI and exportable as a file for Postman / Insomnia — without writing any schema twice.

## Where (development)
| What | URL |
|---|---|
| Swagger UI | http://localhost:3000/docs |
| Raw OpenAPI JSON | http://localhost:3000/docs-json |
| Committed copy | [`docs/openapi.json`](openapi.json) |

Swagger is on unless `SWAGGER_ENABLED=false` (validated in the API config). Set it to `false` in production: `/docs` and `/docs-json` then return 404 Problem Details.

## How it is generated
- Request and response schemas come from the **shared Zod schemas** via Zod 4's built-in `z.toJSONSchema()` — no `@ApiProperty` DTO classes to keep in sync.
- Small decorators in `apps/api/src/docs/zod-openapi.ts` turn a schema into OpenAPI (from `employees.controller.ts`):
  ```ts
  @Post()
  @Roles('HR')
  @ApiOperation({ summary: 'Create an employee' })
  @apiBody(createEmployeeSchema)                   // request: strict, required fields, patterns, enums
  @apiEnvelope(employeeSchema, { status: 201 })    // 201 { data: Employee }
  @apiProblems(400, 401, 403, 409)                 // application/problem+json
  create(@Body(new ZodValidationPipe(createEmployeeSchema)) input: CreateEmployeeInput) { … }
  ```
- Success responses are documented **inside the envelope** (`{ data, meta? }`); errors reference one shared `ProblemDetails` component with `application/problem+json`.
- Uploads (`POST /employees/:id/profile-image`) are documented as `multipart/form-data` with a binary `file` field.

## Export the file
```bash
pnpm --filter api docs:export     # writes docs/openapi.json
```
Needs no database or running server (repositories are stubbed) and produces byte-identical output on repeated runs, so the committed file only changes when the API does.

## Kept honest by tests
An e2e test compares every route registered in Nest with the OpenAPI `paths`: an endpoint added without docs fails the suite. Other tests check body strictness, documented error statuses, list query params and the upload schema.

## Try it
Every endpoint except `/auth/login`, `/auth/refresh` and `/auth/logout` needs a session, and write requests need the header `X-Requested-With: hr-payroll`.

1. Run the app ([Getting started](getting-started.md)) and open http://localhost:3000/docs.
2. `POST /auth/login` → **Try it out** → `{ "email": "test@hr.com", "password": "test@123" }` → **Execute**. The browser stores the httpOnly cookie; following calls are authenticated.
3. Expand `GET /employees` → **Try it out** → set `search=hana` → **Execute** to see the paginated envelope.
4. Try `POST /employees` with `"baseSalary": "10.999"` to see a 400 Problem Details with `errors.baseSalary`.
