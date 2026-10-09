# Spec: Employees — HR dashboard (web)

Status: **sketch approved 2026-10-09** (rules and edge cases come in the deep-dive per part). Depends on: `employees` (API, done), `design-system` (done), `api-docs` (done).

## Objective
HR opens one dashboard, sees employees, and creates, edits and deletes them from a side drawer without leaving the list. The web reuses the API contract from `@hr/types`: the same Zod schemas validate the form, and server errors (problem+json) land on the right field.

## Sketch

**Desktop (≥ md)** — list stays visible, drawer slides in from the right.
```
+-----------------------------------------------------------+------------------------+
| HR Payroll                                      (avatar)  |                        |
+-----------------------------------------------------------+  New employee       ✕  |
| Employees                                  [+ New employee]                        |
| [ Search name or email      ] [ Department ▾ ] [ Status ▾ ]  Full name *          |
|                                                            |  [                   ] |
|  Name                Department   Job title   Salary  Status |  Email *             |
|  (AH) Ahmed Zaki     Operations   Ops Lead   12,500.00 ●Act ⋯|  [                   ] |
|  (MO) Mona Hassan    HR           HR Manager 18,000.00 ●Act ⋯|  Base salary *       |
|  (OS) Omar Said      Finance      Accountant  9,750.00 ○Ina ⋯|  [                   ] |
|                                                            |  Job title *         |
|                       < Previous  Page 1 of 3  Next >      |  Department * [    ▾]|
|                                                            |  Hire date *  [date ]|
|                                                            |  Phone        [     ]|
|                                                            |  Status [Active   ▾] |
|                                                            |  Type   [Employee ▾] |
|                                                            |   [Cancel]  [Save]   |
+-----------------------------------------------------------+------------------------+
```

**Mobile (base styles)** — rows become cards, drawer becomes a full-screen sheet.
```
+---------------------------+      +---------------------------+
| HR Payroll           (MH) |      | ✕  New employee           |
| Employees      [+ New]    |      |                           |
| [ Search…               ] |      | Full name *               |
| [ Department ▾][Status ▾] |      | [                       ] |
| +-----------------------+ |      | Email *                   |
| |(AH) Ahmed Zaki      ⋯ | |      | [                       ] |
| | Ops Lead · Operations | |      | Base salary *             |
| | 12,500.00   ● Active  | |      | [                       ] |
| +-----------------------+ |      | …                         |
| +-----------------------+ |      |                           |
| |(MO) Mona Hassan  HR ⋯ | |      | [Cancel]        [Save]    |
| +-----------------------+ |      +---------------------------+
| < Prev  Page 1 of 3  Next>|
+---------------------------+
```

**Row actions (⋯)**: Edit → opens the drawer prefilled. Delete → `ConfirmDialog` ("Delete Ahmed Zaki? They can be restored later.") → soft delete → toast.

## Flows
| Flow | Steps | API |
|---|---|---|
| List | load page 1; search/filter/paginate update the query | `GET /employees`, `GET /departments` |
| Create | `+ New` → empty drawer → Save → toast, list refreshes, drawer closes | `POST /employees` |
| Edit | row ⋯ → Edit → drawer prefilled → Save (only changed fields) → toast | `GET /employees/:id`, `PATCH /employees/:id` |
| Delete | row ⋯ → Delete → confirm → toast | `DELETE /employees/:id` |

## Structure
```
apps/web/src/
  shared/http/           axios instance (web only — never in types/ or the monorepo root); non-2xx → typed ApiError carrying ProblemDetails
  shared/ui/drawer/      new primitive: native <dialog> side sheet (full screen on mobile)
  features/employees/
    api/                 employee-keys.ts, use-employees.ts, use-employee.ts, use-departments.ts,
                         use-create-employee.ts, use-update-employee.ts, use-delete-employee.ts
    components/          employee-list.tsx (table ≥ md, cards below), employee-row-actions.tsx,
                         employee-filters.tsx, employee-form.tsx, employee-drawer.tsx
    pages/               employees-page.tsx (composition + drawer/dialog state)
    employees.scss
  app/                   QueryClientProvider + ToastProvider; App renders EmployeesPage
```
- Form: react-hook-form + `zodResolver(buildCreateEmployeeSchema({ today }))` / update schema; server `errors` map → `setError` per field; anything else → error toast.
- Every query view renders loading (Skeleton), error (retry), empty (EmptyState), success.
- No router yet: a single page. Drawer/dialog state lives in the page.

## Dependencies (approved earlier with the stack)
`@tanstack/react-query`, `axios`, `react-hook-form`, `@hookform/resolvers`.

## Deep-dive 1 — List

### Decisions (2026-10-09)
- **Columns:** avatar + name with email underneath (HR shown as a small badge next to the name) · department · job title · base salary · status badge · ⋯ actions. Hire date and phone stay in the drawer. Mobile cards show the same data stacked.
- **Filters:** search (name or email) + Department + Status. No Type filter.
- **Deleted employees:** a "Show deleted" toggle switches the list to `deleted=true`; there the ⋯ menu offers only **Restore**.
- **Salary:** plain number with thousands separators and 2 decimals (`12,500.00`), no currency label. Formatted by passing the API string to `Intl.NumberFormat` — never converted to a JS number.

### Edge cases (approved 2026-10-09)
1. Order is name A→Z (the API's order); page size fixed at 20.
2. Search is trimmed and debounced 300 ms; empty search sends no param; input capped at 100 chars (the API limit).
3. Any change to search, a filter or the deleted toggle resets to page 1. Toggling deleted keeps search and filters.
4. Search, filters, deleted toggle and page live in the URL query string (`?search=…&page=2`), so refresh and back/forward keep the view. No router: `URLSearchParams` + `history.replaceState`.
5. First load shows Skeleton rows. Paging/filtering keeps the previous rows visible (marked busy) until new data arrives — no flicker.
6. Three empty states: no employees at all → "No employees yet" + New employee action; no matches → "No employees match your filters" + Clear filters; deleted view empty → "No deleted employees".
7. List request fails → inline error with Retry; the filters stay usable. Departments request fails → Department filter disabled with a hint, list still works.
8. When a delete or restore empties the current page and it isn't page 1 → move to the previous page.
9. Badges: Active = success, Inactive = neutral, HR = info, Deleted rows show "Deleted on 9 Oct 2026".
10. Restore → success toast, row leaves the deleted view. Restore fails (e.g. 409 already restored by someone else) → error toast with the server's detail, and the list refetches.
11. Accessibility: a real `<table>` with a caption at ≥ md; result count announced politely ("15 employees"); the ⋯ menu is keyboard-operable with Escape to close and focus returning to its button.

### Implementation contract (tests and code both follow these names)
- `apps/web/src/shared/http/http-client.ts` → `http` (axios instance, `baseURL` = `import.meta.env.VITE_API_URL`, default `http://localhost:3000`); `ApiError extends Error { status: number; problem: ProblemDetails }`; `toApiError(error: unknown): ApiError` — problem+json body → its problem; no response (network) → `status: 0`, title "Network error"; anything else → generic 500-style problem.
- `apps/web/src/shared/format/format-amount.ts` → `formatAmount(value: string): string` (`"12500"` → `"12,500.00"`, `"9999999999.99"` exact; en-US grouping).
- `apps/web/src/shared/hooks/use-debounced-value.ts` → `useDebouncedValue<T>(value: T, delayMs: number): T`.
- `apps/web/src/shared/ui/menu/` → `Menu` primitive: trigger button (`aria-haspopup="menu"`, `aria-expanded`) + `role="menu"` items; Escape/outside click closes; focus returns to the trigger; arrow keys move between items.
- `features/employees/api/`
  - `employees-api.ts` → `fetchEmployees(query: EmployeeListQuery): Promise<{ items: Employee[]; meta: PaginationMeta }>`, `fetchDepartments(): Promise<Department[]>`, `restoreEmployee(id: string): Promise<Employee>` (unwrap the `{ data, meta }` envelope).
  - `employee-keys.ts` → `employeeKeys.all / list(query) / detail(id)`, `departmentKeys.all`.
  - `use-employees.ts` (`keepPreviousData`), `use-departments.ts`, `use-restore-employee.ts` (invalidates `employeeKeys.all`).
- `features/employees/list-state.ts` → `EmployeeListState = { search: string; departmentId?: string; status?: EmployeeStatus; deleted: boolean; page: number }`, `parseListState(params: URLSearchParams): EmployeeListState` (invalid values → defaults), `toSearchParams(state): URLSearchParams` (omits defaults), `toListQuery(state, debouncedSearch): EmployeeListQuery`; hook `use-employee-list-state.ts` syncs it with `window.location.search` via `history.replaceState`, and its setters reset `page` to 1 per edge case 3.
- `features/employees/components/` → `employee-filters.tsx`, `employee-list.tsx` (table ≥ md + cards), `employee-row-actions.tsx` (Restore in the deleted view; Edit/Delete arrive with the form and delete deep-dives), `employee-status-badge.tsx`.
- `features/employees/pages/employees-page.tsx`; `src/app/providers.tsx` (`QueryClientProvider` + `ToastProvider`); `App.tsx` renders `EmployeesPage` (preview route unchanged).
- Tests mock `employees-api.ts` with `vi.mock` — no network, no new mocking library.

## To decide in the deep-dives (not yet)
- **Form:** field order, which fields are editable after create, phone input format help, salary input (currency label? thousands separators?), hire date max = today in which time zone on the client, profile image upload inside the drawer, unsaved-changes guard on close.
- **Errors & feedback:** which server errors show inline vs toast (409 email, 422 last HR), retry behaviour, optimistic updates or not.
- **Display:** salary formatting/currency, status/type badges, avatar initials vs photo.
- **Delete:** wording, last-HR (422) message, undo via restore from the toast?

## Success criteria (for the sketch)
The layout, flows and structure above are approved; each deep-dive then adds its edge cases here before tests are written.
