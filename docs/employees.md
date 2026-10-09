# Employees

[← Docs index](README.md) · specs: [`specs/employees/spec.md`](../specs/employees/spec.md), [`specs/employees-web/spec.md`](../specs/employees-web/spec.md)

HR manages employee records: create, list (paginated, searchable, filterable), view, update, soft-delete, restore and upload a profile image.

## Endpoints
| Method & path | Success | Notes |
|---|---|---|
| `POST /employees` | 201 `Employee` | body: `createEmployeeSchema` |
| `GET /employees` | 200 `Employee[]` + `meta` | `page`, `pageSize`, `search`, `departmentId`, `status`, `type`, `deleted` |
| `GET /employees/:id` | 200 `Employee` | |
| `PATCH /employees/:id` | 200 `Employee` | partial update; includes `taxTableId` (uuid or `null` = default table) |
| `DELETE /employees/:id` | 204 | soft delete |
| `POST /employees/:id/restore` | 200 `Employee` | |
| `POST /employees/:id/profile-image` | 200 `Employee` | multipart field `file` |
| `GET /departments` | 200 `Department[]` | seeded, read-only, ordered by name |

All bodies follow the [response envelope](api-responses-and-errors.md); write routes are HR-only (see [Authentication](authentication.md)).

## Rules
| Field | Rule |
|---|---|
| `fullName`, `jobTitle` | required, trimmed, 1–100 chars |
| `email` | required, trimmed, lowercased, valid, **unique case-insensitive forever** (deleted rows included) → 409 on duplicate |
| `phone` | optional, E.164 (`+201001234567`); spaces, dashes and parentheses stripped; empty → `null` |
| `departmentId` | must exist (unknown → 400 on `departmentId`) |
| `hireDate` | required `YYYY-MM-DD`, a real calendar date, **not in the future** ("today" = API local date, `TZ=Africa/Cairo`) |
| `baseSalary` | string, > 0, ≤ 2 decimals, ≤ 9,999,999,999.99; never rounded |
| `status` / `type` | `ACTIVE`/`INACTIVE` (default ACTIVE) · `HR`/`EMPLOYEE` (default EMPLOYEE) |

## Behaviour
- **List:** `search` is a case-insensitive *contains* on full name **or** email; filters are exact matches; sorted by `fullName`, then `id`; `pageSize` 1–100 (default 20).
- **Soft delete:** sets `deletedAt`. Deleted employees disappear from the list (unless `deleted=true`) and `GET`/`PATCH`/`DELETE`/upload on them → 404. Re-hiring someone = restore (the email stays reserved).
- **Last-HR guard:** deleting, deactivating or demoting the **last active, non-deleted HR** → 422, so the system can never lose its admin.
- **Profile image:** JPEG / PNG / WebP detected from the file's **bytes** (signature sniffing, not the declared mimetype) → else 415; max 2 MB → else 413. Stored on local disk behind a `FileStorage` interface (swappable for S3), served from `/uploads/…`; replacing an image deletes the old file.

## Web
- `/employees`: table with search (debounced), department / status / type filters, pagination, skeleton loading, empty and error states.
- Create / edit in a drawer form (react-hook-form + the shared Zod schema); server field errors land under the matching input.
- Row menu: edit, Pay tab, Payslip, delete (confirm dialog), restore from the deleted filter.

## Known limitations
- The last-HR guard is check-then-act: two simultaneous HR edits could both pass (a serializable transaction would close it).
- If saving the record fails after an image is stored, the new file is orphaned (a cleanup job would fix it).
- Uploaded images are served publicly.
