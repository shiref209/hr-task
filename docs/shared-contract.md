# Shared types & schemas (`@hr/types`)

[← Docs index](README.md)

## One contract, three consumers
Validation rules exist **once**, as Zod schemas in `types/src/`. From each schema we get:

| Consumer | How it uses the schema |
|---|---|
| **API** | `ZodValidationPipe(schema)` validates body, query and params. The API never trusts the client |
| **Web** | react-hook-form uses the same schema through a resolver, so the browser shows the exact rules the API enforces |
| **TypeScript** | `z.infer` / `z.output` types (`Employee`, `CreateEmployeeInput`, `Payslip`, …) used by both apps |
| **OpenAPI** | `apps/api/src/docs/` converts the schemas with `z.toJSONSchema`, so Swagger can't drift from the code |

Change a rule in one place and the API, the form, the types and the docs all follow; `pnpm typecheck` flags every consumer that needs updating.

## Layout
```
types/src/
  common/
    api-response.ts       ApiResponse<T>, PaginationMeta
    problem-details.ts    ProblemDetails, ProblemType (the problem `type` URIs)
    pagination.ts         paginationQuerySchema (page ≥ 1 default 1, pageSize 1–100 default 20)
    dates.ts              calendar-date (YYYY-MM-DD) helpers
    id-param.ts           idParamSchema { id: uuid }
  employees/
    employee.schema.ts    employeeSchema, create/update schemas, list query, department, enums
    employee-summary      EmployeeSummary = Employee without pay fields (for the EMPLOYEE role)
  payroll/
    money.schema.ts       money (string, > 0, ≤ 2 dp) and rate (string, 0–100, ≤ 2 dp)
    tax-table.schema.ts   bracket and table input/response schemas
    social-insurance.schema.ts · pay-items.schema.ts · payslip.schema.ts
  auth/                   loginSchema, Role, AuthUser
  index.ts                re-exports everything
```

## Conventions
- **Bodies are strict**: unknown properties are rejected with `errors.<key> = ['Unknown field']`. **Query strings strip** unknown params.
- **Normalisation happens in the schema**: emails trimmed and lowercased, phone spaces/dashes stripped, empty strings → `null`. The service receives clean data.
- **Money is a string** (`"5000.00"`) everywhere in the contract, never a JS `number`, so no float rounding can creep in between browser, API and database.
- **Response schemas are tested too**: every schema rule has tests on both sides of its boundary (`types/src/**/*.test.ts`, Vitest).

## Build
`@hr/types` compiles to CommonJS (`types/dist`) for the API. The web app does not use the build: `vite.config.ts` aliases `@hr/types` to `types/src/index.ts`. `pnpm dev`, `pnpm test` and `pnpm typecheck` build the package first.
