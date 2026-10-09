# Spec: Payroll — tax tables, social insurance, pay items, payslip

Status: **approved 2026-10-09**. Depends on: `employees`, `api-foundation`.

## Objective
HR configures how pay is calculated (tax tables, social insurance) and each employee's monthly allowances and deductions, then views a payslip for any employee and month showing gross, tax (with %), social insurance, deductions and net.

## Capability map
| Module id | Responsibility | Depends on |
|---|---|---|
| `payroll-calculator` | Pure calculation: brackets, insurance, deductions, rounding | — |
| `payroll-settings` | Tax tables (with brackets, one default) and social insurance settings; CRUD API | — |
| `pay-items` | Per-employee recurring allowances and deductions; employee's tax table override | employees, payroll-settings |
| `payslip` | `GET /employees/:id/payslip?month=YYYY-MM` | all of the above |
| `payroll-web` | Settings screen, Pay section in the employee drawer, Payslip drawer | all of the above |

Build order: payroll-calculator → payroll-settings → pay-items → payslip → payroll-web.

## Decisions (2026-10-09)
- **Marginal (progressive) brackets.** Each slice of the taxable amount is taxed at its own bracket's rate.
- **Taxable amount = base salary only.** Allowances are not taxed.
- **Social insurance** = `min(base × rate, cap)`; the cap is optional and limits the **contribution amount**.
- **Net never goes below 0.** Tax and insurance always apply; other deductions apply in list order only up to what is left; the rest is reported as *unapplied*.
- **Rounding:** half-up to 2 decimals **per payslip line**; totals are sums of rounded lines, so the payslip always adds up.
- **Tax tables:** several tables, exactly one default. Employees use the default unless HR assigns a table. A table assigned to any employee can't be deleted (409); the default can't be deleted.
- **Allowances / other deductions:** per-employee recurring monthly items, the same every month.
- **Payslip months:** from the hire month onward, active employees only; future months allowed as a preview. Uses **current** settings (no history).
- **Payslip view:** row menu → "Payslip" drawer with a month picker.
- **Navigation (web):** `react-router-dom` with a sidebar: **Employees** and **Settings** (Settings → Tax tables with their brackets, Social insurance). Mobile: the sidebar collapses behind a menu button.

## Calculation (payroll-calculator, pure TS in `apps/api/src/payroll/domain/`)
Contract: `calculatePay(input: PayInput): PayBreakdown` in `apps/api/src/payroll/domain/payroll-calculator.ts` (no Nest/Prisma/HTTP imports; `decimal.js` only).
```ts
type PayInput = {
  baseSalary: string;
  allowances: { name: string; amount: string }[];
  deductions: { name: string; amount: string }[];
  brackets: { upTo: string | null; rate: string }[];   // validated, ascending, last upTo null
  socialInsurance: { rate: string; cap: string | null };
};
type PayBreakdown = {
  baseSalary: string; allowances: { name: string; amount: string }[]; allowancesTotal: string; gross: string;
  tax: { total: string; effectiveRate: string; brackets: { from: string; upTo: string | null; rate: string; taxable: string; tax: string }[] };
  socialInsurance: { rate: string; cap: string | null; amount: string; capped: boolean };
  deductions: { name: string; requested: string; applied: string }[];
  deductionsApplied: string; deductionsUnapplied: string; net: string;
};
```
All strings formatted with exactly 2 decimals (rates and caps included; the open bracket's `upTo` is `null`). Inputs may be any decimal string (`"1100"`, `"5"`) and are normalised.
- Allowance/deduction names are echoed unchanged, in input order. Every bracket appears as a line, even with `taxable` 0.00.
- Precondition: `baseSalary > 0` (guaranteed by the employee schema), so `effectiveRate` never divides by zero — no guard in the calculator.
- `capped` is decided on the unrounded contribution: `capped = base × rate / 100 > cap`.
```
allowancesTotal = Σ allowances
gross           = base + allowancesTotal
for each bracket slice (prevUpTo, upTo]:
  taxable_i     = max(0, min(base, upTo ?? ∞) − prevUpTo)
  tax_i         = round(taxable_i × rate_i / 100)          ← one line per bracket
tax             = Σ tax_i
effectiveRate   = round(tax / base × 100)                  ← shown as %, not used in math
insurance       = round(min(base × siRate / 100, cap ?? ∞))
available       = gross − tax − insurance                  (≥ 0, see edge case 14)
for each deduction in order:
  applied_j     = min(requested_j, available − Σ applied so far)
unapplied       = Σ requested − Σ applied
net             = gross − tax − insurance − Σ applied      (≥ 0)
```
All math in `Decimal`; `round` = half-up to 2 dp. Money in and out as strings.

### Worked examples (default table: ≤10,000 @ 0% · ≤20,000 @ 10% · above @ 15%; insurance 11%, cap 2,000)
| Base | Allowances | Tax | Effective | Insurance | Deductions | Net |
|---|---|---|---|---|---|---|
| 10,000.00 | 0 | 0.00 | 0.00% | 1,100.00 | 0 | 8,900.00 |
| 10,000.01 | 0 | 0.00 (0.001 → 0.00) | 0.00% | 1,100.00 | 0 | 8,900.01 |
| 20,000.00 | 0 | 1,000.00 | 5.00% | 2,000.00 (cap; 2,200 uncapped) | 0 | 17,000.00 |
| 25,000.00 | 1,500 | 1,750.00 | 7.00% | 2,000.00 | 500 | 22,250.00 |
| 12,345.65 | 0 | 234.57 (234.565 → up) | 1.90% | 1,358.02 (1,358.0215) | 0 | 10,753.06 |
| 5,000.00 | 0 | 0.00 | 0.00% | 550.00 | 6,000 requested | 0.00 (4,450 applied, 1,550 unapplied) |

## Data model (Prisma)
- `TaxTable`: id, name (unique, case-insensitive, 1–60), isDefault (exactly one true), createdAt/updatedAt.
- `TaxBracket`: id, taxTableId (cascade), position, upTo `NUMERIC(12,2)` nullable (null = no upper limit), rate `NUMERIC(5,2)`.
- `SocialInsuranceSettings`: single row — rate `NUMERIC(5,2)`, cap `NUMERIC(12,2)` nullable.
- `Employee.taxTableId`: nullable FK (null = use the default), `onDelete: Restrict`.
- `EmployeePayItem`: id, employeeId (cascade), kind `ALLOWANCE | DEDUCTION`, name (1–60), amount `NUMERIC(12,2)` > 0, position.
- Seed: table "Standard" (default) with the example brackets; insurance 11%, cap 2,000; a few employees with allowances/deductions.

## API
| Method & path | Success | Notes |
|---|---|---|
| `GET /tax-tables` | 200 list with brackets, default first | |
| `POST /tax-tables` | 201 | `{ name, brackets[] }` |
| `PUT /tax-tables/:id` | 200 | replaces name + brackets |
| `POST /tax-tables/:id/default` | 200 | makes it the default (old default unset, one transaction) |
| `DELETE /tax-tables/:id` | 204 | 409 if default or assigned to any employee (detail names the count) |
| `GET /payroll-settings/social-insurance` | 200 | `{ rate, cap }` |
| `PUT /payroll-settings/social-insurance` | 200 | |
| `GET /employees/:id/pay-items` | 200 | `{ allowances[], deductions[] }` |
| `PUT /employees/:id/pay-items` | 200 | replaces both lists (order kept) |
| `PATCH /employees/:id` | 200 | existing endpoint gains `taxTableId: uuid \| null` |
| `GET /employees/:id/payslip?month=YYYY-MM` | 200 `Payslip` | |

`Payslip`: `{ employee {id, fullName}, month, taxTable {id, name}, baseSalary, allowances[{name, amount}], allowancesTotal, gross, tax {total, effectiveRate, brackets[{from, upTo, rate, taxable, tax}]}, socialInsurance {rate, cap, amount, capped}, deductions[{name, requested, applied}], deductionsApplied, deductionsUnapplied, net, warnings[] }` — all money as strings.

## Edge cases (approved 2026-10-09)
**Brackets & tables**
1. Boundaries are inclusive upper limits: base exactly 10,000.00 is taxed only in the first bracket; 10,000.01 puts 0.01 in the second.
2. A table needs ≥ 1 bracket; upper limits strictly increasing and > 0; only the last bracket has no upper limit (and it must); the first bracket starts at 0 implicitly. Violations → 400 on the bracket's field path (e.g. `brackets.1.upTo`).
3. Rates 0–100 with up to 2 decimals (12.5% OK, 12.345% → 400). Rates don't have to increase.
4. A single bracket with no limit = a flat tax for everyone (e.g. 0% table for exempt staff).
5. Table names are unique, case-insensitive (409).
6. Exactly one default at all times. Making another table default switches atomically. The default can't be deleted (409 "Choose another default first").
7. Deleting a table assigned to **active (non-deleted)** employees → 409 "Used by N employees". Assignments held only by soft-deleted employees don't block it: the delete clears them in the same transaction, and if such an employee is restored later they use the default table (decided 2026-10-09). `employeeCount` counts non-deleted employees only; the default table also counts non-deleted employees with no table assigned (they use it). Unassigned → 204.
8. Changing the default immediately changes payslips of employees without an override (no history).
8a. `PATCH /employees/:id` with an unknown `taxTableId` → 400 `errors.taxTableId = ['Select a tax table']` (same as an unknown department); `null` clears the override.

**Social insurance**
9. Rate 0–100 (2 dp); cap optional, > 0 when set. Rate 0 → insurance 0 for everyone.
10. Insurance exactly at the cap shows `capped: false`; above it, `capped: true` and the capped amount.

**Pay items**
11. Names 1–60 chars; amounts > 0 with ≤ 2 decimals; **no limit** on the number of items (only the API's request body size bounds it); duplicate names allowed (e.g. two loans).
12. Zero allowances → gross = base. Zero deductions → nothing applied.

**Net & deductions**
13. Deductions exceeding what's left: applied in list order up to the available amount; net = 0; payslip `warnings` includes "1,550.00 of deductions could not be applied".
14. Settings guard: saving a tax table or insurance rate is rejected (422) if *highest bracket rate + insurance rate > 100%*, because tax + insurance could then exceed the base salary and make net negative before any deduction.

**Rounding**
15. Each bracket line, insurance and effective rate are rounded half-up to 2 dp (`x.xx5` → up); tax total = sum of rounded bracket lines; net is computed from rounded lines, so `gross − tax − insurance − applied = net` exactly.

**Payslip requests**
16. `month` must be `YYYY-MM` with month 01–12 (`2026-13`, `2026-3`, missing → 400).
17. Month before the hire month → 422 "Not yet hired in 2026-02 (hire date 2026-03-15)" (requested month + hire date); the hire month itself is a full month (no proration).
18. Inactive employee → 422; deleted or unknown employee → 404.
19. Future months are allowed (preview) and use current settings.

## Implementation contract (settings, pay items, payslip)

**`types/src/payroll/`** (re-exported from `types/src/index.ts`)
- `tax-table.schema.ts`: `taxBracketInputSchema` `{ upTo: money | null, rate: rate }`; `taxTableInputSchema` `{ name, brackets }` (strict; bracket rules from edge cases 2–3 reported at `brackets.<i>.upTo` / `brackets.<i>.rate`); `taxTableSchema` (response) `{ id, name, isDefault, brackets: { upTo, rate }[], employeeCount }`. `money` = string, > 0, ≤ 2 dp; `rate` = string, 0–100, ≤ 2 dp.
- `social-insurance.schema.ts`: `socialInsuranceSchema` `{ rate, cap: money | null }`.
- `pay-items.schema.ts`: `payItemSchema` `{ name (1–60, trimmed), amount: money }`; `payItemsSchema` `{ allowances: payItem[], deductions: payItem[] }` (strict).
- `payslip.schema.ts`: `payslipQuerySchema` `{ month: 'YYYY-MM' }`; `Payslip` type (= `PayBreakdown` + `employee {id, fullName}`, `month`, `taxTable {id, name}`, `warnings: string[]`).
- `updateEmployeeSchema` gains `taxTableId: uuid | null`; `employeeSchema` gains `taxTable: { id, name } | null` (null = uses the default).

**`apps/api/src/payroll/`** — flat Nest feature modules, dependency inversion as elsewhere
- `domain/payroll-calculator.ts` (done in the calculator slice).
- `tax-tables/`: module, controller (`/tax-tables`), service, `tax-tables.repository.ts` (`TaxTableRepository`, token `TAX_TABLE_REPOSITORY`: `findAll`, `findById`, `findDefault`, `findByName`, `create`, `update`, `setDefault`, `delete`, `countAssignedEmployees`, `highestRate()`), `prisma-tax-tables.repository.ts`, `tax-tables.errors.ts`.
- `social-insurance/`: module, controller (`/payroll-settings/social-insurance`), service, repository (`SOCIAL_INSURANCE_REPOSITORY`: `get`, `save`), prisma repo.
- Rate ceiling (edge case 14): `rate-ceiling.ts` pure function `assertRateCeiling(highestBracketRate, insuranceRate)` → throws `BusinessRuleError`; used by both services (each reads the other side through its repository interface).
- `pay-items/`: module, controller (`/employees/:id/pay-items`), service, repository (`PAY_ITEM_REPOSITORY`: `findByEmployee`, `replaceForEmployee`), prisma repo. Unknown/deleted employee → 404.
- `payslip/`: module, controller (`GET /employees/:id/payslip`), `payslip.service.ts` — loads employee, its tax table (or default), insurance settings and pay items via repository interfaces, checks edge cases 16–19, calls `calculatePay`, adds warnings.
- `payroll.module.ts` imports the four modules; `AppModule` imports it.
- Test fakes in `apps/api/test/fakes/`: `InMemoryTaxTableRepository`, `InMemorySocialInsuranceRepository`, `InMemoryPayItemRepository`.

## Testing strategy
- Calculator: pure unit tests for every worked example and edge cases 1, 4, 10, 12, 13, 15 (no Nest, no DB).
- Settings / pay items: Zod schema tests (types) + service tests with in-memory repositories + e2e per endpoint.
- Payslip: service tests with fakes (edge cases 16–19) + one e2e per status code.
- Web: deep-dives later (settings screen, pay section, payslip drawer), each with its own sketch and edge cases.

## Boundaries
- Always: money as `Decimal`/strings; calculator has no framework imports; config from the database, validated on write.
- Ask first: payslip history/snapshots, proration, per-month overrides.
- Never: JS `number` for money; hard-coded rates or brackets.
