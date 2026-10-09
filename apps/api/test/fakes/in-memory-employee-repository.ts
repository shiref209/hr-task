import { randomUUID } from 'node:crypto';
import type {
  CreateEmployeeInput,
  Department,
  Employee,
  EmployeeListQuery,
} from '@hr/types';
import type {
  EmployeeChanges,
  EmployeeRepository,
} from '../../src/employees/employees.repository';
import { ENGINEERING, FINANCE, HUMAN_RESOURCES } from './employee.builder';

export class InMemoryEmployeeRepository implements EmployeeRepository {
  /** Shared, ordered event log ('update') so tests can assert call order across fakes. */
  log: string[] = [];

  constructor(
    seed: Employee[] = [],
    private readonly departments: Department[] = [
      ENGINEERING,
      HUMAN_RESOURCES,
      FINANCE,
    ],
    private readonly taxTables: { id: string; name: string }[] = [],
  ) {
    this.rows = seed.map((employee) => ({ ...employee }));
  }

  private rows: Employee[];

  /** Every stored row, deleted ones included. */
  get all(): Employee[] {
    return this.rows.map((employee) => ({ ...employee }));
  }

  async findById(
    id: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Employee | null> {
    const row = this.rows.find((e) => e.id === id);
    if (!row || (row.deletedAt !== null && !options.includeDeleted))
      return null;
    return { ...row };
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const row = this.rows.find(
      (e) => e.email.toLowerCase() === email.toLowerCase(),
    );
    return row ? { ...row } : null;
  }

  async list(
    query: EmployeeListQuery,
  ): Promise<{ items: Employee[]; totalItems: number }> {
    const search = query.search?.toLowerCase();
    const matching = this.rows
      .filter((e) => (e.deletedAt !== null) === query.deleted)
      .filter(
        (e) => !query.departmentId || e.department.id === query.departmentId,
      )
      .filter((e) => !query.status || e.status === query.status)
      .filter((e) => !query.type || e.type === query.type)
      .filter(
        (e) =>
          !search ||
          e.fullName.toLowerCase().includes(search) ||
          e.email.toLowerCase().includes(search),
      )
      .sort(
        (a, b) =>
          a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id),
      );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: matching
        .slice(start, start + query.pageSize)
        .map((e) => ({ ...e })),
      totalItems: matching.length,
    };
  }

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const now = new Date().toISOString();
    const employee: Employee = {
      id: randomUUID(),
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      jobTitle: input.jobTitle,
      department: this.departmentOf(input.departmentId),
      hireDate: input.hireDate,
      baseSalary: toMoney(input.baseSalary),
      status: input.status,
      type: input.type,
      profileImageUrl: null,
      taxTable: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(employee);
    return { ...employee };
  }

  async update(id: string, changes: EmployeeChanges): Promise<Employee> {
    const row = this.rows.find((e) => e.id === id);
    if (!row) throw new Error(`InMemoryEmployeeRepository: no row ${id}`);
    const { departmentId, deletedAt, baseSalary, ...rest } = changes;
    for (const [key, value] of Object.entries(rest)) {
      if (key !== 'taxTableId' && value !== undefined)
        Object.assign(row, { [key]: value });
    }
    if ('taxTableId' in rest && rest.taxTableId !== undefined) {
      const id = rest.taxTableId;
      const taxTable = this.taxTables.find((t) => t.id === id);
      Object.assign(row, {
        taxTable: taxTable ? { id: taxTable.id, name: taxTable.name } : null,
      });
    }
    if (departmentId !== undefined)
      row.department = this.departmentOf(departmentId);
    if (baseSalary !== undefined) row.baseSalary = toMoney(baseSalary);
    if (deletedAt !== undefined)
      row.deletedAt = deletedAt ? deletedAt.toISOString() : null;
    row.updatedAt = new Date().toISOString();
    this.log.push('update');
    return { ...row };
  }

  /** Mirrors the real delete of a tax table: every holder falls back to the default. */
  clearTaxTable(taxTableId: string): void {
    for (const row of this.rows)
      if (row.taxTable?.id === taxTableId) row.taxTable = null;
  }

  async countActiveHr(): Promise<number> {
    return this.rows.filter(
      (e) => e.type === 'HR' && e.status === 'ACTIVE' && e.deletedAt === null,
    ).length;
  }

  private departmentOf(id: string): Department {
    return this.departments.find((d) => d.id === id) ?? { id, name: 'Unknown' };
  }
}

function toMoney(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}
