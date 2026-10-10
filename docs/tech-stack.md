# Tech stack & packages

[← Docs index](README.md)

Rule followed: no library for something a few lines or the platform can do; every dependency has a reason.

## Workspace
| Package | Why |
|---|---|
| pnpm 10 workspaces | Strict, fast monorepo with a shared lockfile; no extra orchestrator needed |
| TypeScript (`strict`) | One language across API, web and shared types; no `any` |
| Prettier | One formatting style |
| Docker Compose (PostgreSQL 17) | Same database for everyone with one command |
| GitHub Actions | CI on every push to `main`: lint, typecheck, tests, build ([CI](ci.md)) |

## Shared — `@hr/types`
| Package | Why |
|---|---|
| zod 4 | One schema = runtime validation + TS types + JSON Schema for the docs |
| vitest | Fast test runner for the schema rules |

## API — `@hr/api`
| Package | Why |
|---|---|
| NestJS 11 (`@nestjs/core`, `common`, `platform-express`) | Preferred backend in the brief; modules + DI give the layering and dependency inversion for free |
| Prisma 6.19 + `@prisma/client` | Typed queries and versioned migrations. Pinned to 6.x: Prisma 7 needs a driver adapter and config file for no benefit here |
| PostgreSQL 17 | Relational data, `NUMERIC` for exact money, transactions for the default-table switch |
| decimal.js | Exact decimal arithmetic for money in the pure calculator (imported directly so `domain/` has no Prisma dependency) |
| @nestjs/swagger | Serves Swagger UI; schemas come from Zod via `z.toJSONSchema`, not decorators |
| @nestjs/jwt | Signs and verifies access tokens |
| cookie-parser | Reads the httpOnly auth cookies |
| @nestjs/throttler | Login rate limits (per IP + email, per IP, per email), applied only to `POST /auth/login` |
| nestjs-pino + pino-http | Structured JSON request logs with redaction; Nest's logger routed through pino ([Logging](logging-and-health.md)) |
| pino-pretty (dev) | Readable logs in development |
| rxjs, reflect-metadata | NestJS runtime requirements |
| Jest + ts-jest | Nest's default test runner |
| Supertest | Drives the real HTTP stack in e2e tests |
| ESLint + typescript-eslint + Prettier plugin | Lint rules for the API |
| @nestjs/cli 11.0.10 | Pinned: 12.x fails on Node 22.14 |

Built-ins used instead of packages: Node `crypto.scrypt` for password hashing (no bcrypt), `--env-file` (no dotenv), file-signature sniffing for images (no file-type), Node `http.STATUS_CODES` for problem titles.

## Web — `@hr/web`
| Package | Why |
|---|---|
| React 19 | Allowed by the brief; component model fits the drawer/table UI |
| Vite 8 + @vitejs/plugin-react | Fast dev server, simple config, aliases `@hr/types` source |
| react-router-dom 7 | Sidebar navigation: Employees, Settings, login |
| @tanstack/react-query 5 | Server-state caching, loading/error states and invalidation after mutations |
| axios | One client with an interceptor that turns every error into a typed `ApiError` |
| react-hook-form + @hookform/resolvers | Forms validated by the same Zod schemas as the API |
| sass | SCSS for BEM nesting and breakpoint mixins (tokens stay CSS variables) |
| @fontsource-variable/inter | Self-hosted font: no third-party request |
| Vitest + Testing Library + jsdom + user-event | Vite-native tests that exercise behaviour through roles and labels |
| oxlint | Very fast linter for the web app |

## Deliberately not added
| Left out | Instead |
|---|---|
| UI kit (MUI, Tailwind, …) | Own small design system in `shared/ui` with CSS tokens — the brief asks for CSS/SCSS |
| dotenv | Node's `--env-file` |
| bcrypt / argon2 | Node's built-in `crypto.scrypt` |
| Date library | `Intl.DateTimeFormat` handles time zones and formatting |
| class-validator / class-transformer | Zod, shared with the web |
| Passport | A small JWT guard is enough for cookie-based JWT |
