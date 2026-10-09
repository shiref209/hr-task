# Spec: Payroll — web (navigation, settings, pay tab, payslip)

Status: **approved 2026-10-09**. Depends on: `payroll` (API, done), `employees-web`, `design-system`.

## Objective
HR moves between Employees and Settings from a sidebar, manages tax tables and social insurance, edits each employee's tax table, allowances and deductions, and opens any employee's payslip for a month.

## Decisions (2026-10-09)
- `react-router-dom` with a sidebar: **Employees**, **Settings → Tax tables**, **Settings → Social insurance**. Mobile: the sidebar collapses behind a menu button.
- Tax tables are edited in a **side drawer** (reuses `Drawer`).
- Employee pay is a **"Pay" tab** in the edit drawer (`Details | Pay`) with its own Save; edit mode only.
- The payslip drawer always opens on the **current month** (browser's local month).

## Sketch
**App shell (desktop ≥ md / mobile)**
```
+-------------+---------------------------------+     +----------------------------+
| HR Payroll  |  <page>                         |     | ☰  HR Payroll              |
|             |                                 |     +----------------------------+
| ▸ Employees |                                 |     |  <page>                    |
| Settings    |                                 |     |                            |
|  ▸ Tax tables                                 |     | ☰ opens the sidebar as a   |
|  ▸ Social insurance                           |     |   sheet over the page      |
+-------------+---------------------------------+     +----------------------------+
```
**Tax tables** (`/settings/tax-tables`)
```
Tax tables                                  [+ New table]
+------------------------------------------------------+
| Standard                        [Default]          ⋯ |   ⋯ = Edit · Set as default · Delete
|  up to 10,000.00   0%                                |
|  up to 20,000.00   10%                               |
|  above             15%                               |
|  Used by 12 employees                                |
+------------------------------------------------------+
Drawer "Edit Standard" / "New tax table":
 Name [Standard            ]
 Each rate applies only to the part of the salary inside its bracket. …
 Bracket 1: from 0.00
   Up to amount  Tax rate %
   [10000.00]    [0     ]   (remove)
 Bracket 2: from 10,000.00
   Up to amount  Tax rate %
   [20000.00]    [10    ]   (remove)
 Bracket 3: above 20,000.00
   Up to amount  Tax rate %
   No limit      [15    ]
 [+ Add bracket]
                         [Cancel] [Save]
```
**Social insurance** (`/settings/social-insurance`)
```
Social insurance
 Rate %          [11.00 ]
 [x] Cap the monthly contribution
 Cap             [2,000.00]
                                   [Save]
```
**Pay tab** (edit drawer)
```
[ Details ] [ Pay ]
 Tax table [Default (Standard) ▾]
 Allowances                       Deductions
  [Transport ] [1,500.00] (x)      [Loan     ] [500.00] (x)
  [+ Add allowance]                [+ Add deduction]
                                  [Cancel] [Save pay]
```
**Payslip drawer** (row ⋯ → Payslip)
```
Payslip — Omar Farouk                         x
 Month [2026-10 ▾]
 Base salary                       38,000.50
 Transport                          1,500.00
 Housing                            3,000.00
 Gross                             42,500.50
 Tax (Standard, 9.74%)             -3,700.08
   0 – 10,000.00 @ 0%      0.00
   10,000.00 – 20,000.00 @ 10%   1,000.00
   above 20,000.00 @ 15%  2,700.08
 Social insurance (11%, capped)    -2,000.00
 Loan                                -500.00
 Net                               36,300.42
 ⚠ 2,150.00 of deductions could not be applied   (only when present)
```

## Structure
```
apps/web/src/
  app/              router.tsx (routes + redirects), app-layout.tsx (sidebar shell)
  shared/ui/        nav/sidebar primitives if needed; tabs primitive for Details | Pay
  features/payroll/
    api/            tax-tables / social-insurance / pay-items / payslip calls + query hooks
    components/     tax-table-card, tax-table-form (bracket rows), social-insurance-form,
                    pay-items-editor, payslip-view
    pages/          tax-tables-page, social-insurance-page
  features/employees/components/  employee-drawer gains the Pay tab; row menu gains "Payslip"
```
Money stays a string end to end (input: same salary-style normalisation; display: `formatAmount`).

## Implementation contract (tests and code both follow these names)
- `react-router-dom` v7 (data routers not required): `app/router.tsx` exports `AppRoutes` (used inside `<BrowserRouter>` in `main.tsx`, and inside `<MemoryRouter initialEntries>` in tests). Routes: `/` → redirect `/employees`; `/employees`; `/settings/tax-tables`; `/settings/social-insurance`; `*` → `NotFoundPage`. The dev-only `/design-system` preview keeps working.
- `app/app-layout.tsx` → `AppLayout` (sidebar `<nav aria-label="Main">` with `NavLink`s "Employees", "Tax tables", "Social insurance" under a "Settings" heading; mobile menu button named "Open menu"; `<main>` with `<Outlet />`).
- `shared/ui/tabs/` → `Tabs` (`tabs: { id, label }[]`, `activeId`, `onChange`, children = active panel): WAI-ARIA tabs (`role="tablist"/"tab"/"tabpanel"`, `aria-selected`, arrow keys move between tabs).
- `features/payroll/api/`
  - `payroll-api.ts`: `fetchTaxTables()`, `createTaxTable(input)`, `updateTaxTable(id, input)`, `setDefaultTaxTable(id)`, `deleteTaxTable(id)`, `fetchSocialInsurance()`, `updateSocialInsurance(input)`, `fetchPayItems(employeeId)`, `replacePayItems(employeeId, items)`, `fetchPayslip(employeeId, month)`.
  - `payroll-keys.ts` + hooks: `use-tax-tables.ts`, `use-tax-table-mutations.ts` (create/update/setDefault/delete), `use-social-insurance.ts`, `use-pay-items.ts`, `use-payslip.ts` (`keepPreviousData`). Tax-table mutations also invalidate employee lists (`employeeCount` / names shown in the Pay tab).
- `features/payroll/components/`: `tax-table-card.tsx`, `tax-table-drawer.tsx` (+ `tax-table-form.tsx` with bracket rows), `social-insurance-form.tsx`, `pay-tab.tsx` (tax table select + `pay-items-editor.tsx`), `payslip-drawer.tsx` (+ `payslip-view.tsx`).
- `features/payroll/pages/`: `tax-tables-page.tsx`, `social-insurance-page.tsx`.
- `features/employees`: the edit drawer gains `Tabs` "Details" | "Pay"; the row ⋯ menu gains "Payslip" (active, non-deleted rows) after Edit.
- `shared/format/month.ts` → `currentMonth(): 'YYYY-MM'` (browser local).
- Tests mock `features/payroll/api/payroll-api.ts` and `features/employees/api/employees-api.ts` with `vi.mock`; no network.

## Edge cases (approved 2026-10-09)
**Navigation**
1. `/` redirects to `/employees`; unknown paths show a "Page not found" view with a link back. The list's existing query-string state keeps working under `/employees`.
2. The active sidebar link has `aria-current="page"`. On mobile, the menu button toggles the sidebar sheet (Esc and selecting a link close it; focus returns to the button).

**Tax tables page**
3. Tables listed default first; each shows its brackets, "Used by N employees" and a Default badge.
4. ⋯ on the default table offers Edit only (no Set as default, no Delete); others offer Edit · Set as default · Delete.
5. Delete asks for confirmation; a 409 ("Used by N employees") shows inside the dialog like the employee last-HR case.
6. Set as default updates both cards immediately after success and toasts "Standard is now the default".

**Tax table editor**
7. New table starts with one open bracket ("No limit", rate empty). Each bracket is a group named by its range ("Bracket 2: from 10,000.00", open one "above <previous limit>") with the same two fields, "Up to amount" and "Tax rate %". "Add bracket" inserts a limited row **before** the open one; the open last row can't be removed; the remove button is hidden when only one bracket remains.
8. Validation from the shared schema on blur and submit; server errors map to the exact row (`brackets.1.upTo` → second row's Up to).
9. Rates and limits use the salary-style input (typed separators stripped, formatted on blur). Rates may have 2 decimals.
10. 422 rate ceiling ("highest bracket rate + insurance rate > 100%") shows as a form alert; 409 duplicate name on the Name field.
11. Unsaved-changes guard, same as the employee drawer.

**Social insurance page**
12. Cap is optional via the checkbox; unchecking hides the Cap field and sends `cap: null`; checking it requires a cap > 0. No live example line (it would duplicate payroll math in the browser).
13. 422 rate ceiling shows as a form alert; Save disabled while unchanged.

**Pay tab**
14. Tax table select lists "Default (<name>)" first, then every table; saving sends `taxTableId: null` for Default.
15. Allowance/deduction rows: name + amount, add/remove freely, no limit; empty list allowed; duplicate names allowed; order kept.
16. "Save pay" sends PATCH (tax table, only if changed) and PUT pay-items (only if changed); if one succeeds and the other fails, the succeeded part stays saved, the error shows on the failing part, and the form keeps the user's input.
17. Switching tabs keeps unsaved input in both tabs; closing the drawer with unsaved changes in either tab triggers the guard.

**Payslip drawer**
18. Opens on the current month; month picker (native `type="month"`). Each change refetches; previous payslip stays visible while loading.
19. 422 "Not yet hired…" or "inactive" shows as an inline message in the drawer (not a toast); 404 closes the drawer with a toast and refetches the list.
20. Warnings render as an alert under Net. Deductions partially applied show "requested → applied".
21. "Payslip" is offered for active, non-deleted employees only (hidden in the deleted view).
