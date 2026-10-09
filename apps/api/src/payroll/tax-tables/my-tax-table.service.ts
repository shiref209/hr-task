import { Inject, Injectable } from '@nestjs/common';
import { appliedTaxTableSchema, type AppliedTaxTable } from '@hr/types';
import { EmployeeNotFoundError } from '../../employees/employees.errors';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from '../../employees/employees.repository';
import { resolveAppliedTaxTable } from './resolve-applied-tax-table';
import {
  TAX_TABLE_REPOSITORY,
  type TaxTableRepository,
} from './tax-tables.repository';

@Injectable()
export class MyTaxTableService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(TAX_TABLE_REPOSITORY)
    private readonly taxTables: TaxTableRepository,
  ) {}

  /** The employee's override, else the default table. */
  async forEmployee(employeeId: string): Promise<AppliedTaxTable> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new EmployeeNotFoundError();
    return appliedTaxTableSchema.parse(
      await resolveAppliedTaxTable(employee, this.taxTables),
    );
  }
}
