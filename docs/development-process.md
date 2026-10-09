# Development process — spec-driven + test-driven

[← Docs index](README.md)

The project was built with **spec-driven development (SDD)** combined with **test-driven development (TDD)**. Every feature passes the same gate, written down in [`CLAUDE.md`](../CLAUDE.md) so both the developer and the AI agents follow it.

## The per-feature gate
| Step | What happens | Output |
|---|---|---|
| 1. **Spec** | Objective, scope, data model, API contract, implementation contract (file and function names) and acceptance criteria | `specs/<feature>/spec.md`, reviewed and approved before any code |
| 2. **Edge cases** | Edge cases are listed and confirmed with the product owner; each decision is dated in the spec | "Edge cases (approved …)" section |
| 3. **Red** | Every confirmed edge case becomes a failing test first | Schema, unit and e2e tests |
| 4. **Green** | The smallest implementation that makes the tests pass: reuse what exists, stdlib/platform first | Production code |
| 5. **Refactor & verify** | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter api test:e2e`, then a review against the spec | Green suite, review notes |
| 6. **Commit** | Small Conventional Commits, one logical change each; [CI](ci.md) re-runs every gate on push to `main` | Git history, green CI |

**Why SDD:** the spec settles product questions (e.g. marginal vs flat tax, is the cap on the base or the contribution, can net go negative) *before* code, so the tests encode agreed behaviour rather than guesses. The implementation contract in each spec fixes names up front so tests and code are written against the same interface.

**Why TDD:** money and authorization are areas where silent mistakes are expensive. Writing the test first proves each rule is actually checked, and the suite lets the code be refactored safely.

## Specs
| Feature | Spec |
|---|---|
| Response envelope & error handling | [`specs/api-foundation`](../specs/api-foundation/spec.md) |
| API docs (OpenAPI from Zod) | [`specs/api-docs`](../specs/api-docs/spec.md) |
| Employees API | [`specs/employees`](../specs/employees/spec.md) |
| Design system | [`specs/design-system`](../specs/design-system/spec.md) |
| Employees web | [`specs/employees-web`](../specs/employees-web/spec.md) |
| Payroll API | [`specs/payroll`](../specs/payroll/spec.md) |
| Payroll web | [`specs/payroll-web`](../specs/payroll-web/spec.md) |
| Authentication & authorization | [`specs/auth`](../specs/auth/spec.md) |

## Test suites
| Suite | Runner | Covers |
|---|---|---|
| `types` | Vitest | every schema rule on both sides of each boundary |
| API unit | Jest | payroll calculator, error filter, Zod pipe, envelope, services with in-memory fakes, image sniffing, guards |
| API e2e | Jest + Supertest | every endpoint's status codes and body shapes through the real Nest wiring (`configureApp`), permission matrix, OpenAPI completeness |
| web | Vitest + Testing Library | design-system components, pages, forms, error mapping, formatting |

Principles:
- **No test touches a real database, network or filesystem.** Repositories and file storage are replaced by in-memory fakes in `apps/api/test/fakes/`; time is a fixed `Clock`.
- The payroll calculator is pure, so its tests are plain input → output tables (every worked example and rounding boundary).
- Web tests query by role and label, the way a user (or screen reader) finds things.

```bash
pnpm test                       # types + API unit + web
pnpm --filter api test:e2e      # API over HTTP
pnpm typecheck && pnpm lint
```

Not covered automatically: the Prisma repositories and local file storage (they need a real database/disk); verified by manual smoke runs.

## AI usage
Built with Claude Code under the rules in [`CLAUDE.md`](../CLAUDE.md): every spec and edge case was decided by the developer before any code, tests were the acceptance contract, a validator agent checked each slice against its spec, and every commit was approved individually. See the README's [AI usage](../README.md#ai-usage) section.
