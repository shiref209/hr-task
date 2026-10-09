# Spec: Employees — CRUD (API)

Status: **approved 2026-10-08**

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

## Architecture (flat Nest module + dependency inversion, per CLAUDE.md)
```
apps/api/src/employees/
  employees.module.ts
  employees.controller.ts            thin: parse, call one service method, map
  employees.service.ts               use cases incl. last-HR guard, restore; depends on tokens only
  employees.repository.ts            EmployeeRepository interface + token
  prisma-employees.repository.ts     Prisma impl; translates unique violations → ConflictError
  employees.errors.ts                domain errors
  profile-image/                     file-storage port + local-disk impl, signature sniffing
apps/api/src/departments/
  departments.module.ts · departments.controller.ts · departments.repository.ts · prisma-departments.repository.ts
apps/api/src/prisma/                 PrismaService + schema, migrations, seed
```
No `domain/` folder here: employees has no pure business-rule engine (the last-HR guard is a service rule).

## Implementation contract (tests and code both follow these names)

**`types/src/employees/employee.schema.ts`** (re-exported from `types/src/index.ts`; also `todayInTimeZone` from `types/src/common/dates.ts`)
- `employeeStatusSchema` = `z.enum(['ACTIVE','INACTIVE'])`, `employeeTypeSchema` = `z.enum(['HR','EMPLOYEE'])`; types `EmployeeStatus`, `EmployeeType`.
- `departmentSchema` `{ id, name }` → `Department`.
- `employeeSchema` (response shape) → `Employee`: `id, fullName, email, phone: string|null, jobTitle, department: Department, hireDate: 'YYYY-MM-DD', baseSalary: string ('5000.00'), status, type, profileImageUrl: string|null, deletedAt: string|null (ISO), createdAt, updatedAt (ISO)`.
- `buildCreateEmployeeSchema({ today }: { today: string })` → strict object; `CreateEmployeeInput = z.output<…>`. `today` is `YYYY-MM-DD`; hire date must be ≤ it. The schema takes `today` instead of reading a clock, so it stays pure and the web form and API share one rule.
- `buildUpdateEmployeeSchema({ today })` → strict, every field optional, `phone` may be `null` (clears it); `{}` → issue at `_root` "Nothing to update". `UpdateEmployeeInput`.
- `employeeListQuerySchema` = `paginationQuerySchema` + `search?` (trimmed, max 100, empty → undefined), `departmentId?` uuid, `status?`, `type?`, `deleted` (`'true'|'false'` → boolean, default false). Query objects **strip** unknown params (bodies are strict). `EmployeeListQuery`.
- `idParamSchema` = `{ id: z.uuid() }` (in `types/src/common/`).
- `todayInTimeZone(timeZone: string, now?: Date): string` → `YYYY-MM-DD` via `Intl.DateTimeFormat`.

**API common additions**
- `ZodValidationPipe` constructor also accepts a **factory** `() => ZodType` (evaluated per `transform` call).
- `common/clock.ts`: `interface Clock { now(): Date; today(): string }`, token `CLOCK`, `SystemClock` (uses `APP_TIMEZONE`).
- `common/config.ts`: `appConfig` = Zod-validated env (`APP_TIMEZONE` default `Africa/Cairo`, `UPLOADS_DIR` default `uploads`); invalid env fails fast at startup.
- `domain-errors.ts` gains `UnsupportedMediaTypeError` → 415 (`ProblemType.unsupportedMediaType`).

**`apps/api/src/departments/`**
- `departments.repository.ts`: `interface DepartmentRepository { findAll(): Promise<Department[]>; exists(id: string): Promise<boolean> }`, token `DEPARTMENT_REPOSITORY`.
- `departments.service.ts` `DepartmentsService.findAll()`; `departments.controller.ts` `GET /departments`; `prisma-departments.repository.ts`; `departments.module.ts` (exports the token).

**`apps/api/src/employees/`**
- `employees.repository.ts`: token `EMPLOYEE_REPOSITORY` and
  ```ts
  interface EmployeeRepository {
    findById(id: string, options?: { includeDeleted?: boolean }): Promise<Employee | null>;
    findByEmail(email: string): Promise<Employee | null>;        // includes deleted
    list(query: EmployeeListQuery): Promise<{ items: Employee[]; totalItems: number }>;
    create(input: CreateEmployeeInput): Promise<Employee>;
    update(id: string, changes: EmployeeChanges): Promise<Employee>; // UpdateEmployeeInput & { deletedAt?: Date|null; profileImageUrl?: string|null }
    countActiveHr(): Promise<number>;                              // ACTIVE, type HR, not deleted
  }
  ```
- `employees.errors.ts`: `EmployeeNotFoundError` (NotFound), `EmailAlreadyUsedError` (Conflict; message says when the owner is deleted and can be restored), `EmployeeNotDeletedError` (Conflict), `LastHrError` (BusinessRule), `DepartmentNotFoundError` → `ValidationError({ departmentId: ['Department does not exist'] })`.
- `employees.service.ts` `EmployeesService` (injects `EMPLOYEE_REPOSITORY`, `DEPARTMENT_REPOSITORY`, `CLOCK`, `FILE_STORAGE`): `create`, `list` (→ `PaginatedResult<Employee>`), `getById`, `update`, `remove`, `restore`, `setProfileImage(id, file: UploadedImage)` where `UploadedImage = { buffer: Buffer; size: number }`.
  - Order rules: the employee must exist **before** a file is saved; when replacing, save new → update record → remove old file.
- `employee-input.pipes.ts`: `CreateEmployeePipe` / `UpdateEmployeePipe` — injectable subclasses of `ZodValidationPipe` that build the schema per request from the injected `Clock`.
- `profile-image/`: `file-storage.ts` (`interface FileStorage { save(buffer: Buffer, extension: string): Promise<string /* public URL path */>; remove(url: string): Promise<void> }`, token `FILE_STORAGE`), `local-file-storage.ts`, `image-type.ts` → `detectImageType(buffer): 'jpeg' | 'png' | 'webp' | null` (magic bytes only).
- Upload limits: Nest `FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } })` → multer's 413 is mapped by the filter. Missing file → `ValidationError({ file: ['File is required'] })`. Unknown signature → `UnsupportedMediaTypeError`. Files served via `app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' })`.
- `prisma-employees.repository.ts`: maps Prisma rows ↔ `Employee` (Decimal → `toFixed(2)` string, `@db.Date` → `YYYY-MM-DD`); unique violation `P2002` → `EmailAlreadyUsedError`.
- Test fakes (written by the testing agent, used by unit and e2e tests): `apps/api/test/fakes/` → `InMemoryEmployeeRepository`, `InMemoryDepartmentRepository`, `InMemoryFileStorage`, `FixedClock`.

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
