import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import { formatAmount } from '@hr/types';
import { parseSalary } from './salary';

/** onBlur handler factory: formats a valid amount salary-style, leaves an invalid one as typed so its error stays visible. */
export function useFormatOnBlur<V extends FieldValues>({
  trigger,
  getValues,
  setValue,
}: Pick<UseFormReturn<V>, 'trigger' | 'getValues' | 'setValue'>) {
  return (name: Path<V>) => async () => {
    if (!(await trigger(name))) return;
    const normalized = parseSalary(String(getValues(name)));
    if (normalized) setValue(name, formatAmount(normalized) as PathValue<V, Path<V>>);
  };
}
