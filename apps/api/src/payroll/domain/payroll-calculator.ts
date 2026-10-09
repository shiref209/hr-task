import type { PayItem, Payslip } from '@hr/types';
import Decimal from 'decimal.js';

export type PayInput = {
  baseSalary: string;
  allowances: PayItem[];
  deductions: PayItem[];
  brackets: { upTo: string | null; rate: string }[];
  socialInsurance: { rate: string; cap: string | null };
};

export type PayBreakdown = Omit<
  Payslip,
  'employee' | 'month' | 'taxTable' | 'warnings'
>;

const ZERO = new Decimal(0);
const round = (value: Decimal) =>
  value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const percent = (amount: Decimal, rate: Decimal) => amount.times(rate).div(100);
const sum = (values: Decimal[]) => values.reduce((a, b) => a.plus(b), ZERO);

function taxByBracket(base: Decimal, brackets: PayInput['brackets']) {
  let from = ZERO;
  return brackets.map(({ upTo, rate }) => {
    const limit = upTo === null ? null : new Decimal(upTo);
    const top = limit === null ? base : Decimal.min(base, limit);
    const taxable = Decimal.max(ZERO, top.minus(from));
    const line = { from, upTo: limit, rate: new Decimal(rate), taxable };
    from = limit ?? from;
    return { ...line, tax: round(percent(taxable, line.rate)) };
  });
}

function socialInsurance(
  base: Decimal,
  { rate, cap }: PayInput['socialInsurance'],
) {
  const raw = percent(base, new Decimal(rate));
  const limit = cap === null ? null : new Decimal(cap);
  const capped = limit !== null && raw.gt(limit);
  return { amount: round(capped ? limit : raw), capped, limit };
}

function applyDeductions(deductions: PayItem[], available: Decimal) {
  let left = available;
  return deductions.map(({ name, amount }) => {
    const requested = new Decimal(amount);
    const applied = Decimal.min(requested, left);
    left = left.minus(applied);
    return { name, requested, applied };
  });
}

export function calculatePay(input: PayInput): PayBreakdown {
  const base = new Decimal(input.baseSalary);
  const allowancesTotal = sum(
    input.allowances.map((a) => new Decimal(a.amount)),
  );
  const gross = base.plus(allowancesTotal);

  const brackets = taxByBracket(base, input.brackets);
  // Sum of the rounded lines, so the payslip always adds up.
  const taxTotal = sum(brackets.map((b) => b.tax));
  const insurance = socialInsurance(base, input.socialInsurance);

  const deductions = applyDeductions(
    input.deductions,
    gross.minus(taxTotal).minus(insurance.amount),
  );
  const requested = sum(deductions.map((d) => d.requested));
  const applied = sum(deductions.map((d) => d.applied));

  const f = (value: Decimal) => value.toFixed(2);
  return {
    baseSalary: f(base),
    allowances: input.allowances.map(({ name, amount }) => ({
      name,
      amount: f(new Decimal(amount)),
    })),
    allowancesTotal: f(allowancesTotal),
    gross: f(gross),
    tax: {
      total: f(taxTotal),
      effectiveRate: f(round(taxTotal.div(base).times(100))),
      brackets: brackets.map((b) => ({
        from: f(b.from),
        upTo: b.upTo && f(b.upTo),
        rate: f(b.rate),
        taxable: f(b.taxable),
        tax: f(b.tax),
      })),
    },
    socialInsurance: {
      rate: f(new Decimal(input.socialInsurance.rate)),
      cap: insurance.limit && f(insurance.limit),
      amount: f(insurance.amount),
      capped: insurance.capped,
    },
    deductions: deductions.map((d) => ({
      name: d.name,
      requested: f(d.requested),
      applied: f(d.applied),
    })),
    deductionsApplied: f(applied),
    deductionsUnapplied: f(requested.minus(applied)),
    net: f(gross.minus(taxTotal).minus(insurance.amount).minus(applied)),
  };
}
