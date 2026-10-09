import { Inject, Injectable } from '@nestjs/common';
import type { Employee, Payslip, TaxTable } from '@hr/types';
import { EmployeeNotFoundError } from '../../employees/employees.errors';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from '../../employees/employees.repository';
import { calculatePay } from '../domain/payroll-calculator';
import {
  PAY_ITEM_REPOSITORY,
  type PayItemRepository,
} from '../pay-items/pay-items.repository';
import {
  SOCIAL_INSURANCE_REPOSITORY,
  type SocialInsuranceRepository,
} from '../social-insurance/social-insurance.repository';
import { TaxTableNotFoundError } from '../tax-tables/tax-tables.errors';
import {
  TAX_TABLE_REPOSITORY,
  type TaxTableRepository,
} from '../tax-tables/tax-tables.repository';
import { EmployeeInactiveError, NotYetHiredError } from './payslip.errors';

const withThousandsSeparators = (amount: string) => {
  const [whole, cents] = amount.split('.');
  return `${whole.replace(/\B(?=(\d{3})+$)/g, ',')}.${cents}`;
};

@Injectable()
export class PayslipService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(TAX_TABLE_REPOSITORY)
    private readonly taxTables: TaxTableRepository,
    @Inject(SOCIAL_INSURANCE_REPOSITORY)
    private readonly socialInsurance: SocialInsuranceRepository,
    @Inject(PAY_ITEM_REPOSITORY) private readonly payItems: PayItemRepository,
  ) {}

  async generate(employeeId: string, month: string): Promise<Payslip> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new EmployeeNotFoundError();
    if (employee.status !== 'ACTIVE') throw new EmployeeInactiveError();
    // ISO dates and YYYY-MM compare correctly as strings; the hire month counts in full.
    if (employee.hireDate.slice(0, 7) > month)
      throw new NotYetHiredError(month, employee.hireDate);

    const [taxTable, socialInsurance, { allowances, deductions }] =
      await Promise.all([
        this.taxTableOf(employee),
        this.socialInsurance.get(),
        this.payItems.findByEmployee(employeeId),
      ]);
    const breakdown = calculatePay({
      baseSalary: employee.baseSalary,
      allowances,
      deductions,
      brackets: taxTable.brackets,
      socialInsurance,
    });

    return {
      employee: { id: employee.id, fullName: employee.fullName },
      month,
      taxTable: { id: taxTable.id, name: taxTable.name },
      ...breakdown,
      warnings:
        breakdown.deductionsUnapplied === '0.00'
          ? []
          : [
              `${withThousandsSeparators(breakdown.deductionsUnapplied)} of deductions could not be applied`,
            ],
    };
  }

  private async taxTableOf(employee: Employee): Promise<TaxTable> {
    const table = employee.taxTable
      ? await this.taxTables.findById(employee.taxTable.id)
      : await this.taxTables.findDefault();
    if (!table) throw new TaxTableNotFoundError();
    return table;
  }
}
