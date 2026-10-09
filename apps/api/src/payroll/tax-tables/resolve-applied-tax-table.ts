import type { Employee, TaxTable } from '@hr/types';
import { TaxTableNotFoundError } from './tax-tables.errors';
import type { TaxTableRepository } from './tax-tables.repository';

/** The employee's override table, else the default one. */
export async function resolveAppliedTaxTable(
  employee: Employee,
  taxTables: TaxTableRepository,
): Promise<TaxTable> {
  const table = employee.taxTable
    ? await taxTables.findById(employee.taxTable.id)
    : await taxTables.findDefault();
  if (!table) throw new TaxTableNotFoundError();
  return table;
}
