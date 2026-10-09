import type { TaxTable, TaxTableInput } from '@hr/types';
import { formatAmount } from '../../../shared/format/format-amount';
import { normalizeSalary } from '../../employees/form/salary';

export interface BracketFormValues {
  upTo: string;
  rate: string;
}

export interface TaxTableFormValues {
  name: string;
  brackets: BracketFormValues[];
}

/** One open bracket ("and above"); its `upTo` is always empty. */
export const emptyTaxTableValues: TaxTableFormValues = {
  name: '',
  brackets: [{ upTo: '', rate: '' }],
};

export function toFormValues({ name, brackets }: TaxTable): TaxTableFormValues {
  return {
    name,
    brackets: brackets.map(({ upTo, rate }) => ({
      upTo: upTo === null ? '' : formatAmount(upTo),
      rate: normalizeSalary(rate),
    })),
  };
}

/** The last bracket is the open one, whatever its `upTo` text says. */
export function toInput({ name, brackets }: TaxTableFormValues): TaxTableInput {
  const last = brackets.length - 1;
  return {
    name,
    brackets: brackets.map(({ upTo, rate }, index) => ({
      upTo: index === last ? null : normalizeSalary(upTo),
      rate: normalizeSalary(rate),
    })),
  };
}
