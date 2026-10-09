# HR Payroll — Documentation

Each point below links to one document. Read them in order for a full tour, or jump to the one you need.

1. **[Getting started](getting-started.md)** — prerequisites, environment, the scripts to run in order, demo accounts and a walkthrough to test the whole flow.
2. **[Architecture](architecture.md)** — pnpm monorepo, folder structure, feature modules with dependency inversion, how a request flows.
3. **[Shared types & schemas](shared-contract.md)** — the `@hr/types` package: Zod schemas shared by API, web and the OpenAPI docs.
4. **[API responses & error handling](api-responses-and-errors.md)** — the `{ data, meta }` envelope, RFC 7807 Problem Details, the global error filter on the API and the single error path on the web.
5. **[Authentication & authorization](authentication.md)** — JWT in httpOnly cookies, refresh-token rotation, HR / EMPLOYEE roles and the permission matrix.
6. **[Employees](employees.md)** — employee CRUD, search and pagination, soft delete and restore, profile images, the last-HR guard.
7. **[Payroll & payslip](payroll.md)** — salary calculation, marginal (progressive) tax brackets, social insurance cap, allowances, deductions, rounding and the payslip.
8. **[API docs (Swagger)](api-docs.md)** — OpenAPI generated from the Zod schemas, Swagger UI at http://localhost:3000/docs, exporting `openapi.json`.
9. **[Design system](design-system.md)** — tokens, components and usage examples; dev-only preview at http://localhost:5173/design-system.
10. **[Tech stack & packages](tech-stack.md)** — every package per app with a one-line justification, and what was deliberately left out.
11. **[Development process](development-process.md)** — spec-driven development with test-driven development, the per-feature gate and the test suites.

Other references:
- [`openapi.json`](openapi.json) — committed OpenAPI spec (live Swagger UI at http://localhost:3000/docs).
- [`../specs/`](../specs) — the approved spec each feature was built from.
- [`../CLAUDE.md`](../CLAUDE.md) — project rules followed by the AI agents.
