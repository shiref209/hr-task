# Payroll & payslip

[← Docs index](README.md) · specs: [`specs/payroll/spec.md`](../specs/payroll/spec.md), [`specs/payroll-web/spec.md`](../specs/payroll-web/spec.md)

HR configures how pay is calculated (tax tables, social insurance) and each employee's monthly allowances and deductions, then views a payslip for any employee and month.

## Decisions at a glance
| Topic | Decision | Why |
|---|---|---|
| Tax method | **Marginal (progressive) brackets** — each slice of income is taxed at its own bracket's rate | How real income tax works; crossing a boundary never lowers net pay (no "cliff") |
| Taxable amount | **Base salary only**; allowances are not taxed | Agreed product rule; keeps tax predictable |
| Social insurance | `min(base × rate, cap)` — the optional **cap limits the contribution amount** | Mirrors a contribution ceiling; HR can turn it off |
| Allowances | Recurring per-employee items, added to gross, no cap, not taxed | |
| Other deductions | Applied in list order and **never push net below 0**; the rest is reported as *unapplied* | A payslip can't pay a negative amount; HR sees what's left over |
| Rounding | Half-up to 2 dp **per payslip line**; totals are sums of rounded lines | The payslip always adds up exactly |
| Configuration | Brackets, rates and cap are data in the database, validated on write — **never hard-coded** | HR can change rules without a deploy |
| Tax tables | Several tables, exactly one default; an employee uses the default unless HR assigns one | e.g. a 0% table for exempt staff |
| History | Payslips use the **current** settings (no snapshots) | Scope; snapshots are a future step |

## The calculation
Pure TypeScript in [`apps/api/src/payroll/domain/payroll-calculator.ts`](../apps/api/src/payroll/domain/payroll-calculator.ts): `calculatePay(input) → breakdown`. No Nest, Prisma or HTTP imports; all math in `Decimal` (decimal.js); money in and out as strings.

```
allowancesTotal = Σ allowances
gross           = base + allowancesTotal
for each bracket (prevUpTo, upTo]:
  taxable_i     = max(0, min(base, upTo ?? ∞) − prevUpTo)
  tax_i         = round(taxable_i × rate_i / 100)        ← one payslip line per bracket
tax             = Σ tax_i
effectiveRate   = round(tax / base × 100)                ← shown as %, not used in math
insurance       = round(min(base × siRate / 100, cap ?? ∞))
available       = gross − tax − insurance
for each deduction in order:
  applied_j     = min(requested_j, available − Σ applied so far)
unapplied       = Σ requested − Σ applied
net             = gross − tax − insurance − Σ applied    (≥ 0)
```

### Worked examples
Default table: ≤ 10,000 @ 0% · ≤ 20,000 @ 10% · above @ 15%; insurance 11%, cap 2,000.

| Base | Allowances | Tax | Effective | Insurance | Deductions | Net |
|---|---|---|---|---|---|---|
| 10,000.00 | 0 | 0.00 | 0.00% | 1,100.00 | 0 | 8,900.00 |
| 10,000.01 | 0 | 0.00 (0.001 → 0.00) | 0.00% | 1,100.00 | 0 | 8,900.01 |
| 20,000.00 | 0 | 1,000.00 | 5.00% | 2,000.00 (capped; 2,200 uncapped) | 0 | 17,000.00 |
| 25,000.00 | 1,500 | 1,750.00 | 7.00% | 2,000.00 | 500 | 22,250.00 |
| 12,345.65 | 0 | 234.57 (234.565 → up) | 1.90% | 1,358.02 | 0 | 10,753.06 |
| 5,000.00 | 0 | 0.00 | 0.00% | 550.00 | 6,000 requested | 0.00 (4,450 applied, 1,550 unapplied) |

For 25,000: 10,000 × 0% + 10,000 × 10% + 5,000 × 15% = 1,750. A flat-rate system taxing the whole 25,000 at 15% would charge 3,750.

## Validation rules
**Tax tables**
- ≥ 1 bracket; upper limits strictly increasing and > 0; only the last bracket is open-ended (and it must be). Errors point at the field, e.g. `brackets.1.upTo`.
- Rates 0–100 with ≤ 2 decimals; rates don't have to increase. One open bracket = flat tax.
- Names unique, case-insensitive (409). Exactly one default; switching the default is atomic.
- The default table can't be deleted (409). A table used by active employees can't be deleted (409 "Used by N employees").
- Boundaries are inclusive upper limits: 10,000.00 is taxed only in the first bracket.

**Social insurance** — rate 0–100 (2 dp); cap optional, > 0 when set. Exactly at the cap → `capped: false`.

**Rate ceiling** — saving a table or insurance rate is rejected (422) if *highest bracket rate + insurance rate > 100%*, since tax + insurance could then exceed the salary.

**Pay items** — names 1–60 chars, amounts > 0 with ≤ 2 dp, duplicates allowed (e.g. two loans), any number of items.

**Payslip requests** — `month` must be `YYYY-MM` (→ 400). Before the hire month → 422 (the hire month is a full month, no proration). Inactive employee → 422. Deleted/unknown → 404. Future months allowed as a preview.

## Endpoints
| Method & path | Success |
|---|---|
| `GET /tax-tables` | list with brackets and `employeeCount`, default first |
| `POST /tax-tables` · `PUT /tax-tables/:id` | create · replace name + brackets |
| `POST /tax-tables/:id/default` | make it the default |
| `DELETE /tax-tables/:id` | 204 (409 if default or in use) |
| `GET / PUT /payroll-settings/social-insurance` | `{ rate, cap }` |
| `GET / PUT /employees/:id/pay-items` | `{ allowances[], deductions[] }` (PUT replaces both, order kept) |
| `GET /employees/:id/payslip?month=YYYY-MM` | `Payslip` |

The payslip contains: employee, month, applied tax table, base, allowances and total, gross, tax total + effective rate + one line per bracket, insurance (rate, cap, amount, `capped`), deductions (requested vs applied), applied/unapplied totals, net, and `warnings` (e.g. "1,550.00 of deductions could not be applied").

## Code map
```
apps/api/src/payroll/
  domain/payroll-calculator.ts     pure calculation
  rate-ceiling.ts                  pure rule shared by tax tables and social insurance
  tax-tables/ · social-insurance/ · pay-items/   settings modules (controller, service, repository, Prisma repo)
  payslip/payslip.service.ts       loads employee, table, insurance, items via repository interfaces → calculatePay → warnings
apps/web/src/features/payroll/     Settings pages, Pay tab, Payslip drawer
```

## Money handling
`NUMERIC(12,2)` in PostgreSQL (rates `NUMERIC(5,2)`), `Decimal` in code, strings in JSON. The API rejects numeric JSON for money, so a float never enters the system.
