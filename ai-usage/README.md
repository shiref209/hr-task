# AI usage

This project was built with **Claude Code** (Anthropic CLI, model Claude Opus 5.5) working as a coordinator that delegated work to specialised sub-agents. The developer made every product, design and security decision, approved every spec and edge-case list before tests were written, approved commits, and wrote some changes by hand (see *What the developer did*).

## Transcript

[`transcripts/session.md`](transcripts/session.md) — the conversation between the developer and Claude Code (messages only; tool calls, tool output and sub-agent runs are not included). Personal e-mail addresses and local secrets are removed.

## How work was organised

1. **Spec** — each feature started as `specs/<feature>/spec.md` (objective, contract, decisions).
2. **Edge cases** — Claude listed edge cases and asked the developer to confirm or change them before any test was written. Every decision is recorded in the spec with its date.
3. **Tests first** — the `testing` agent wrote failing tests (RED); it was never allowed to write implementation.
4. **Implementation** — `backend`, `database` or `frontend` agents made the tests pass (GREEN) without editing tests; when a test looked wrong they stopped and reported, and the coordinator routed the fix back to the testing agent.
5. **Verification** — the coordinator re-ran every check itself, exercised features in a real browser (Chrome DevTools MCP) against the real API and database, and ran `change-intent-validator` / `security` reviews.
6. **Commit** — only with the developer's explicit approval, Conventional/Angular messages (rule in [`CLAUDE.md`](../CLAUDE.md)).

## What was AI-generated

Almost all code, tests, specs, migrations, seed data and documentation in this repository were drafted by Claude Code and its agents, then reviewed and verified as described above.

## What the developer did

- Chose the stack, scope, architecture rules and workflow (`CLAUDE.md`), and every product rule (e.g. marginal brackets on base salary only, soft delete, future hire dates disallowed, per-account login limits).
- Approved each spec, edge-case list, dependency and commit; rejected or redirected proposals several times (e.g. rounding, tax-table deletion, logout semantics).
- Edited code and docs directly: the commit-approval rule, the `ErrorDetailsFilter` rename, a de-duplication refactor across API and web (shared form/error helpers, shared e2e setup), the `docs/` folder and the CI pipeline.

## Tooling and why it was used

| Tool / config | Why |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) (project) | Project rules: stack, feature-based structure, spec → edge cases → TDD workflow, code, styling, security and commit rules. |
| [`config/global-CLAUDE.md`](config/global-CLAUDE.md) (developer's global instructions) | Behaviour guidelines: think before coding, simplicity first, surgical changes, verifiable goals. |
| `.claude/agents/` — `orchestrator`, `backend`, `database`, `frontend`, `testing`, `security`, `devops`, `performance`, `change-intent-validator` | Separation of concerns: tests and implementation written by different agents; specialised reviews. Adapted from the developer's earlier project and rewritten for this one. |
| `.claude/skills/` (25 skills, e.g. `spec-driven-development`, `test-driven-development`, `code-review-and-quality`, `security-and-hardening`) | Process guidance loaded on demand; the spec and TDD skills defined the gated workflow. |
| `ponytail` plugin (session hook) | Bias toward the smallest correct change, stdlib/native first, no speculative abstractions. |
| `superpowers` plugin (session hook) | Skill-discovery and brainstorming conventions. |
| Chrome DevTools MCP | Visual and behavioural checks in a real browser: design system, layouts at phone/desktop widths, every CRUD/payroll/auth flow against the seeded database. |
| Automatic commit security review (Claude Code) | Flagged three real auth issues after commits (revoked-token purge, per-IP spraying, IPv6 rate-limit bypass) — each fixed test-first in follow-up `fix(auth)` commits. |

Other plugins and connectors were loaded in the environment (e.g. Vercel, PostHog, Sentry, claude.ai connectors) but were **not** used for this project.

## Where AI output was corrected

A few examples recorded in the transcripts and git history:
- Tests that could never pass (e.g. `toHaveValue` with an asymmetric matcher, a Swagger-route completeness check that counted Swagger's own routes, an off-by-one row count) — caught by the implementing agent and fixed in the tests, not by weakening the code.
- A theme token that referenced itself and silently removed every border — found in the browser check.
- Profile images that never displayed (relative URLs resolved against the web origin) — found in the browser check.
- Security review findings (refresh-token rotation race, placeholder JWT secret accepted, IPv6 throttling bypass) — fixed before or right after commit.
- Process slips by the coordinator: two commits made without explicit approval (disclosed at the time; the rule was then followed strictly).
