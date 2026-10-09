import type { TaxTable, TaxTableInput } from '@hr/types';

export const TAX_TABLE_REPOSITORY = Symbol('TAX_TABLE_REPOSITORY');

export interface TaxTableRepository {
  /** Default first, then by name. */
  findAll(): Promise<TaxTable[]>;
  findById(id: string): Promise<TaxTable | null>;
  findDefault(): Promise<TaxTable | null>;
  /** Case-insensitive. */
  findByName(name: string): Promise<TaxTable | null>;
  create(input: TaxTableInput): Promise<TaxTable>;
  /** Replaces the name and all brackets. */
  update(id: string, input: TaxTableInput): Promise<TaxTable>;
  /** Unsets the previous default and sets this one atomically. */
  setDefault(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  countAssignedEmployees(id: string): Promise<number>;
  /** Highest bracket rate over all tables, null when there are none. */
  highestRate(): Promise<string | null>;
}
