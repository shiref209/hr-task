# Plan — Employee Management & Payroll (Interface assessment)

Budget: 6–8h. Smaller scope done well > large scope done poorly.

## Decisions
- Stack: pnpm workspaces — apps/api (NestJS + Prisma + PostgreSQL), apps/web (React + Vite + TS + plain CSS/SCSS, TanStack Query + Axios), packages/types (shared Zod schemas + types).
- Validation: shared Zod schemas in packages/types, enforced by the API via a Zod pipe and reused by web forms.
- Workflow per feature: spec → confirm edge cases with user → TDD → implement → verify → commit (see CLAUDE.md).
- Auth: JWT, roles `HR` (everything) and `EMPLOYEE` (own payslip only), enforced by server guards.
- Allowances / other deductions: per-employee line items (`EmployeeAllowance`, `EmployeeDeduction`: type, name, amount).
- Bonus: docker-compose (db + api + web), GitHub Actions CI, nestjs-pino JSON logs, `/health` (terminus + DB check).
- Money: Postgres `NUMERIC(12,2)`, computed with `Decimal` (decimal.js, already shipped by Prisma). Never JS floats.
- Rounding: full precision inside each calculation; each payslip line rounded half-up to 2 dp; net = sum of rounded lines.

## Assumptions (go in README)
- Tax brackets are monthly.
- Taxable income = gross − social insurance.
- No proration for partial months.
- Payslip for an inactive employee → 422; for a month before hire date → 422.
- Tax brackets, insurance rate and cap come from config validated at startup.

## Architecture
```
apps/api/src/
  employees/  domain/ (entity, rules, repository interface)  application/ (service)
              infrastructure/ (prisma repo)                  presentation/ (controller, DTOs)
  payroll/    domain/ (PayrollCalculator: pure, config injected)  application/ (payslip service)
              presentation/ (payslip controller)
  auth/       JWT strategy, roles guard
  common/     ProblemDetails (RFC 7807) global exception filter, health
  config/     payroll config (brackets, rate, cap)
```

## Slices (each = one or more commits)
| # | Slice | Est. | Done when |
|---|---|---|---|
| 0 | git init, monorepo, docker-compose Postgres, .env.example, .gitignore | 0.5h | `docker compose up db` works |
| 1 | Payroll domain, test-first (brackets, boundaries, cap, zero allowances, rounding) | 1.5h | tests green, no Nest/DB imports in domain |
| 2 | Employee schemas in packages/types + repo interface + Prisma repo + CRUD + pagination/search + ProblemDetails filter + Zod pipe + Swagger + seed | 1.5h | Swagger works, validation tests green |
| 3 | Payslip endpoint | 0.5h | e2e test with in-memory repo |
| 4 | JWT auth (HR / EMPLOYEE) | 1h | EMPLOYEE gets 403 on another payslip |
| 5 | Web: list/search/paginate, create/edit, delete confirm, payslip view, error display | 2h | every flow works manually |
| 6 | Dockerfiles, CI, logging, health | 0.5h | CI green |
| 7 | README + /ai-usage (transcript, CLAUDE.md, plugins/hooks used + why) | 0.5h | — |
