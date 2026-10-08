# HR Payroll — Project Rules

Employee management + payroll calculation for HR. Built for the Interface full-stack assessment
(spec: `~/Desktop/Interface_Code_Assessment_2026.pdf`, plan: `PLAN.md`). Graded on architecture/SOLID,
readability, validation/error handling, tests and AI-usage transparency. Budget 6–8h: smaller scope done well.

These rules override any default in `.claude/agents/*` if they ever conflict.

## Stack
| Area | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| API | NestJS, TypeScript, Prisma, PostgreSQL, Swagger, Jest |
| Web | React + Vite, TypeScript, plain CSS/SCSS (no UI kit), TanStack Query + Axios, react-hook-form, Vitest |
| Shared | `types/` (`@hr/types`): Zod schemas + inferred types, used by both API and web |
| Ops | docker-compose, GitHub Actions, nestjs-pino, `/health` |

Any new dependency: ask first, and justify it in the README. No library for something a few lines can do.

## Structure — feature-based everywhere
```
apps/api/src/<feature>/
  domain/          pure TS: entities, rules, calculators, repository interfaces. No Nest, Prisma or HTTP imports.
  application/     use-case services; depend on domain interfaces via DI tokens
  infrastructure/  Prisma repositories, external adapters
  presentation/    controllers, request/response mapping
apps/api/src/common/   cross-cutting only: ProblemDetails filter, Zod pipe, health
apps/web/src/features/<feature>/
  api/             axios calls + TanStack Query hooks
  components/      presentational; no business logic
  pages/           route-level composition
  <feature>.scss   styles colocated with the feature
apps/web/src/shared/   app-wide UI primitives, http client, error display
types/src/<feature>/   Zod schemas + `z.infer` types shared across apps
specs/<feature>/       spec.md (and plan/tasks when needed)
```
Never put a type used by both apps anywhere but `types/`. It builds to CommonJS for the API;
the web app aliases its TS source in `vite.config.ts`.

## Commands (root)
`pnpm dev` · `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm build` · `docker compose up -d db`
Per package: `pnpm --filter api|web|types <script>`. Nest CLI is pinned to 11.0.10 (12.x fails on Node 22.14).

## Workflow per feature (gated, do not skip)
1. **Spec** — use the `spec-driven-development` skill; write `specs/<feature>/spec.md` (objective, scope, API contract, acceptance criteria). Stop for user review.
2. **Edge cases** — before any test, list the edge cases you see and **ask the user** to confirm/add. Record the answers in the spec.
3. **TDD** — use the `test-driven-development` skill. Red → green → refactor. Every confirmed edge case becomes a test. Unit tests never touch a real DB or network (use in-memory repository fakes).
4. **Implement** — ponytail ladder: reuse what exists, stdlib/native first, shortest correct diff.
5. **Verify** — run typecheck, lint and the full test suite; then review with the `code-review-and-quality` skill or the `change-intent-validator` agent.
6. **Commit** — small, meaningful commits (Conventional Commits). History is graded.

If context is missing, a requirement is ambiguous, or an instruction seems wrong: **stop and ask**. Do not guess.

## Agents
| Agent | Use for |
|---|---|
| `orchestrator` | splitting a feature across api / web / types |
| `backend` | Nest modules, services, controllers |
| `database` | Prisma schema, migrations, seed |
| `frontend` | React features, forms, TanStack Query hooks, SCSS |
| `testing` | test suites, fakes, coverage gaps |
| `security` | auth/roles review, secrets, input validation |
| `devops` | Docker, CI, env config |
| `change-intent-validator` | checking a finished slice against its spec |

## Code rules
- TypeScript `strict`; no `any`, no non-null `!` to silence the compiler.
- Names carry meaning; comments only for *why* clean code can't express (e.g. a rounding rule's rationale).
- Business logic lives in `domain/` (API). Controllers and React components stay thin.
- DI everywhere; inject abstractions (interface + token), not Prisma directly into services.
- Validation: shared Zod schemas, enforced by the API (never trust the client) and reused by the web form.
- Errors: throw domain errors; one global filter maps them to RFC 7807 Problem Details. No try/catch in handlers.
- Money: `NUMERIC(12,2)` in Postgres, `Decimal` (decimal.js) in code, serialized as strings. Never JS `number` for money.
- Payroll rules (brackets, insurance rate, cap) come from validated config, never hard-coded.
- Authorization is enforced on the server (roles guard); hiding UI is only UX.

## Security
Never commit secrets. Real values in gitignored `.env`; keep `.env.example` current.

## AI usage
This session and the tooling used (this file, agents, skills, plugins/hooks) are exported to `/ai-usage` at the end.
Note in the README which parts were AI-generated.
