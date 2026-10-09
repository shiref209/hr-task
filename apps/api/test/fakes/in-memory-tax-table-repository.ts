import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import type { TaxTable, TaxTableInput } from '@hr/types';
import type { InMemoryEmployeeRepository } from './in-memory-employee-repository';
import type { TaxTableRepository } from '../../src/payroll/tax-tables/tax-tables.repository';

// Like Postgres NUMERIC(_,2): money and rates always come back with 2 decimals.
const normalize = (brackets: TaxTableInput['brackets']): TaxTable['brackets'] =>
  brackets.map((b) => ({
    upTo: b.upTo === null ? null : new Decimal(b.upTo).toFixed(2),
    rate: new Decimal(b.rate).toFixed(2),
  }));

export class InMemoryTaxTableRepository implements TaxTableRepository {
  /** Ordered event log ('setDefault', 'delete') so tests can assert call order. */
  log: string[] = [];
  private rows: TaxTable[];

  /** `employees`: source of assignments; only non-deleted employees count (edge case 7). */
  constructor(
    seed: TaxTable[] = [],
    private readonly employees?: InMemoryEmployeeRepository,
  ) {
    this.rows = seed.map((t) => ({
      ...t,
      brackets: t.brackets.map((b) => ({ ...b })),
    }));
  }

  /** Every stored table, in insertion order. */
  get all(): TaxTable[] {
    return this.rows.map((t) => this.withCount(t));
  }

  async findAll(): Promise<TaxTable[]> {
    return this.rows
      .map((t) => this.withCount(t))
      .sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          a.name.localeCompare(b.name),
      );
  }

  async findById(id: string): Promise<TaxTable | null> {
    const row = this.rows.find((t) => t.id === id);
    return row ? this.withCount(row) : null;
  }

  async findDefault(): Promise<TaxTable | null> {
    const row = this.rows.find((t) => t.isDefault);
    return row ? this.withCount(row) : null;
  }

  /** Case-insensitive, as the service relies on it for edge case 5. */
  async findByName(name: string): Promise<TaxTable | null> {
    const row = this.rows.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    return row ? this.withCount(row) : null;
  }

  async create(input: TaxTableInput): Promise<TaxTable> {
    const row: TaxTable = {
      id: randomUUID(),
      name: input.name,
      isDefault: false,
      brackets: normalize(input.brackets),
      employeeCount: 0,
    };
    this.rows.push(row);
    return this.withCount(row);
  }

  async update(id: string, input: TaxTableInput): Promise<TaxTable> {
    const row = this.rows.find((t) => t.id === id);
    if (!row) throw new Error(`InMemoryTaxTableRepository: no row ${id}`);
    row.name = input.name;
    row.brackets = normalize(input.brackets);
    return this.withCount(row);
  }

  /** Atomic by construction: one synchronous pass, so there is never zero or two defaults. */
  async setDefault(id: string): Promise<void> {
    if (!this.rows.some((t) => t.id === id))
      throw new Error(`InMemoryTaxTableRepository: no row ${id}`);
    for (const row of this.rows) row.isDefault = row.id === id;
    this.log.push('setDefault');
  }

  async delete(id: string): Promise<void> {
    this.rows = this.rows.filter((t) => t.id !== id);
    this.employees?.clearTaxTable(id);
    this.log.push('delete');
  }

  async countAssignedEmployees(id: string): Promise<number> {
    return this.employees
      ? this.employees.all.filter(
          (e) => e.deletedAt === null && e.taxTable?.id === id,
        ).length
      : 0;
  }

  /** Highest bracket rate over all stored tables, or null when there are none. */
  async highestRate(): Promise<string | null> {
    const rates = this.rows.flatMap((t) => t.brackets.map((b) => b.rate));
    if (rates.length === 0) return null;
    return rates.reduce((a, b) => (new Decimal(b).gt(a) ? b : a)).toString();
  }

  private withCount(row: TaxTable): TaxTable {
    return {
      ...row,
      brackets: row.brackets.map((b) => ({ ...b })),
      employeeCount: this.countFor(row),
    };
  }

  /** Employees without a table use the default, so they count towards it. */
  private countFor({ id, isDefault }: TaxTable): number {
    return (
      this.employees?.all.filter(
        (e) =>
          e.deletedAt === null &&
          (e.taxTable ? e.taxTable.id === id : isDefault),
      ).length ?? 0
    );
  }
}
