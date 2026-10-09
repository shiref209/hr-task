import { formatAmount } from '@hr/types';

// Plain digits or correctly grouped thousands, optional 1-2 decimals.
const AMOUNT = /^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;

/** The API string ("12500.50") for a typed amount, or null when it isn't one. Never a JS number. */
export function parseSalary(input: string): string | null {
  const trimmed = input.trim();
  if (!AMOUNT.test(trimmed)) return null;
  const [integer = '', fraction = ''] = trimmed.replaceAll(',', '').split('.');
  return `${integer}.${fraction.padEnd(2, '0')}`;
}

/** Normalizes a valid amount; anything else comes back trimmed so the schema can report it. */
export function normalizeSalary(input: string): string {
  return parseSalary(input) ?? input.trim();
}

/** A valid amount formatted for display ("12,500.00"); anything else stays as typed so its error remains visible. */
export function displayAmount(input: string): string {
  return parseSalary(input) ? formatAmount(input) : input;
}
