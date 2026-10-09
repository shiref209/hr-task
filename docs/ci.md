# Continuous integration (GitHub Actions)

[← Docs index](README.md) · workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

Every push to `main` runs all quality gates, so a broken change can't land unnoticed.

## When it runs
On **push to `main`**. One job, `verify`, on `ubuntu-latest`, with a 15-minute timeout.

## Steps
| # | Step | Command | Fails when |
|---|---|---|---|
| 1 | Checkout | `actions/checkout@v4` | |
| 2 | pnpm | `pnpm/action-setup@v4` — version from `packageManager` in `package.json` | |
| 3 | Node | `actions/setup-node@v4` — version from `.nvmrc`, pnpm store cached | |
| 4 | Install | `pnpm install --frozen-lockfile` (also runs `prisma generate`) | `pnpm-lock.yaml` is out of date with a `package.json` |
| 5 | Lint | `pnpm lint` | ESLint (API) or oxlint (web) errors |
| 6 | Typecheck | `pnpm typecheck` | any TypeScript error in types, API or web |
| 7 | Unit tests | `pnpm test` | a types, API unit or web test fails |
| 8 | API e2e tests | `pnpm --filter @hr/api test:e2e` | an endpoint's status, body shape, permission or OpenAPI check fails |
| 9 | Build | `pnpm build` | a production build of any package fails |

## No database, no secrets
The e2e tests boot the real Nest app (`configureApp`) against **in-memory repositories**, and the test setup provides its own JWT secret. The job therefore needs no PostgreSQL service and no GitHub secrets.

## Run the same checks locally
```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm --filter api test:e2e && pnpm build
```
If this passes locally, CI will pass.

## Not covered
- Pull requests from branches don't trigger the workflow (only pushes to `main`).
- Prisma repositories against a real database are not exercised (see [Development process](development-process.md#test-suites)).
- No deployment step: there is no hosted environment.
