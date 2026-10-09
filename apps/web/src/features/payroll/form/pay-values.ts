import type { PayItems } from '@hr/types';
import { displayAmount, normalizeSalary } from '../../../shared/forms/salary';

export interface PayItemRow {
  name: string;
  amount: string;
}

export interface PayFormValues {
  /** '' means "Default" (the API gets null). */
  taxTableId: string;
  allowances: PayItemRow[];
  deductions: PayItemRow[];
}

const toRows = (items: PayItems['allowances']): PayItemRow[] =>
  items.map(({ name, amount }) => ({ name, amount: displayAmount(amount) }));

export function toFormValues(taxTableId: string | null, items: PayItems): PayFormValues {
  return { taxTableId: taxTableId ?? '', allowances: toRows(items.allowances), deductions: toRows(items.deductions) };
}

/** The API representation, so a reformatted amount never counts as a change. */
export function toItems({ allowances, deductions }: PayFormValues): PayItems {
  const normalize = (rows: PayItemRow[]) => rows.map(({ name, amount }) => ({ name, amount: normalizeSalary(amount) }));
  return { allowances: normalize(allowances), deductions: normalize(deductions) };
}
