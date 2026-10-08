# Spec: Employees — CRUD (API)

Status: **decisions recorded — awaiting edge-case sign-off**. Depends on: `api-foundation`.

## Objective
HR manages employee records: create, list (paginated, searchable, filterable), view, update, soft-delete, restore, and upload a profile image. Employee data feeds payroll later. (Auth/roles arrive in the auth slice; a separate `User` table is planned there.)

## Data model
| Field | Type | Rules |
|---|---|---|
| id | uuid | generated |
| fullName | string | required, trimmed, 1–100 chars |
| email | string | required, trimmed, lowercased, valid format, max 254, **unique (case-insensitive)** |
| phone | string \| null | **optional**; E.164 (`+` then 8–15 digits, first digit 1–9); spaces/dashes/parentheses stripped before validating; empty string → null |
| jobTitle | string | required, trimmed, 1–100 |
| departmentId | uuid | required, must reference an existing department (unknown → 400 on `departmentId`) |
| hireDate | date (`YYYY-MM-DD`) | required, **not after today in `APP_TIMEZONE`** (env, default `Africa/Cairo`); real calendar date (`2026-02-30` → 400) |
| baseSalary | Decimal `NUMERIC(12,2)`, string in JSON | required, **> 0**, max 2 decimal places, ≤ 9,999,999,999.99 |
| status | `ACTIVE` \| `INACTIVE` | default `ACTIVE` |
| type | `HR` \| `EMPLOYEE` | default `EMPLOYEE` (HR = admin) |
| profileImageUrl | string \| null | set only by the upload endpoint |
| deletedAt | timestamp \| null | set by soft delete; never accepted from clients |
| createdAt / updatedAt | timestamp | generated |

**Department** (seeded, read-only): `id` uuid, `name` unique. Seed: Engineering, Human Resources, Finance, Sales, Operations, Marketing.

## API contract (all bodies per `api-foundation`)
| Method & path | Success | Notes |
|---|---|---|
| `POST /employees` | 201 `ApiResponse<Employee>` | body: `createEmployeeSchema` |
| `GET /employees` | 200 `ApiResponse<Employee[]>` + `meta` | query: `page`, `pageSize`, `search`, `departmentId`, `status`, `type`, `deleted` (`true` → only deleted, default only non-deleted) |
| `GET /employees/:id` | 200 `ApiResponse<Employee>` | |
| `PATCH /employees/:id` | 200 `ApiResponse<Employee>` | partial; same rules per field |
| `DELETE /employees/:id` | 204 | soft delete (sets `deletedAt`) |
| `POST /employees/:id/restore` | 200 `ApiResponse<Employee>` | clears `deletedAt` |
| `GET /departments` | 200 `ApiResponse<Department[]>` | ordered by name |
| `POST /employees/:id/profile-image` | 200 `ApiResponse<Employee>` | multipart field `file` |

List: `page` ≥ 1 (default 1), `pageSize` 1–100 (default 20), `search` = case-insensitive contains on fullName **or** email, filters are exact matches, ordered by `fullName` asc then `id`.

Profile image: jpeg/png/webp only, checked by **file signature** (not just the declared mimetype), ≤ 2 MB, stored as `uploads/employees/<uuid>.<ext>` (gitignored volume), served at `/uploads/...`. Replacing an image deletes the old file. Soft delete keeps the file (restore brings it back).

Employee responses embed `department: { id, name }`.

**Soft delete**: deleted employees are excluded from `GET /employees` (unless `deleted=true`), and `GET`/`PATCH`/`DELETE`/upload on them → 404. Email stays **unique forever** (case-insensitive, deleted rows included): re-hiring = restore.

**Last-HR guard**: deleting, deactivating (`status → INACTIVE`) or demoting (`type → EMPLOYEE`) the **last active, non-deleted HR** → 422.

## Shared contract (`types/src/employees/`)
`employeeSchema`, `createEmployeeSchema`, `updateEmployeeSchema`, `employeeListQuerySchema`, `departmentSchema`, enums `EmployeeStatus`, `EmployeeType`, inferred types. Same schemas power the web form.

## Architecture
```
apps/api/src/employees/
  domain/          employee.ts, employee.repository.ts (interface + token), employee-errors.ts, last-hr.policy.ts
  application/     employees.service.ts, profile-image.service.ts, file-storage.port.ts
  infrastructure/  prisma-employee.repository.ts, local-file-storage.ts
  presentation/    employees.controller.ts
```
apps/api/src/departments/   domain/ (repository interface), infrastructure/ (prisma repo), presentation/ (controller)
Prisma is introduced in this slice (schema: `Department`, `Employee` + migration + idempotent seed: 6 departments, ~15 employees incl. 2 HR).

## Testing strategy
- Schema tests (types): every rule above, each boundary on both sides.
- Service tests with an **in-memory repository** + in-memory file storage: create, duplicate email (incl. different case), not found, update partial, delete removes image, pagination math.
- Image validation: signature sniffing (png named `.jpg`, text file renamed `.png`, 2 MB exactly vs 2 MB + 1 byte).
- e2e (Supertest, in-memory repo): status codes and envelope/problem shapes per endpoint.

## Edge cases (proposed — confirm)
1. Email uniqueness is case-insensitive: `A@x.com` after `a@x.com` → 409.
2. `PATCH` with a body containing an email already used by **another** employee → 409; the employee's own email → OK.
3. Hire date **today** is valid; tomorrow → 400.
4. `baseSalary: "0"` → 400; `"0.01"` → OK; `"10.005"` → 400 (no rounding of input); numeric JSON `5000` → 400 (money must be a string).
5. Names are trimmed; whitespace-only → 400; exactly 100 chars OK, 101 → 400.
6. Malformed id (`/employees/abc`) → 400; well-formed but missing → 404.
7. `page` beyond the last page → 200 with empty `data` and correct `meta` (not 404).
8. `pageSize` > 100 or < 1, `page` < 1, non-numeric → 400.
9. Uploading for a non-existent or deleted employee → 404, and no file is left on disk.
10. Empty `PATCH` body `{}` → 400 ("nothing to update").
11. Creating with the email of a **deleted** employee → 409, detail says it belongs to a deleted employee who can be restored.
12. Deleting an already-deleted employee → 404. Restoring a non-deleted employee → 409.
13. Last-HR guard: with exactly one active HR, delete / set INACTIVE / set type EMPLOYEE → 422; with two, the first succeeds and the second → 422. An INACTIVE HR doesn't count as an admin.
14. Phone: `"+20 100 123 4567"` → stored `+201001234567`; `"01001234567"` (no `+`) → 400; `""` → null; `"+0123…"` → 400.
15. Hire date `2024-02-29` OK (leap year), `2026-02-29` → 400; "today" computed in `APP_TIMEZONE`.
16. `departmentId` well-formed but unknown → 400 with `errors.departmentId`.

## Boundaries
- Always: validation via shared Zod schemas; repository interface in domain; errors via domain error classes.
- Ask first: new fields, changing money representation.
- Never: Prisma in services/controllers; JS `number` for salary.

## Success criteria
All edge cases above are tests and pass; Swagger documents every endpoint; seed runs idempotently.
