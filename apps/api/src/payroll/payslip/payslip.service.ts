import { Inject, Injectable } from '@nestjs/common';
import { formatAmount, type Payslip } from '@hr/types';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from '../../employees/employees.repository';
import { findEmployeeOrFail } from '../../employees/find-employee-or-fail';
import { calculatePay } from '../domain/payroll-calculator';
import {
  PAY_ITEM_REPOSITORY,
  type PayItemRepository,
} from '../pay-items/pay-items.repository';
import {
  SOCIAL_INSURANCE_REPOSITORY,
  type SocialInsuranceRepository,
} from '../social-insurance/social-insurance.repository';
import { resolveAppliedTaxTable } from '../tax-tables/resolve-applied-tax-table';
import {
  TAX_TABLE_REPOSITORY,
  type TaxTableRepository,
} from '../tax-tables/tax-tables.repository';
import { EmployeeInactiveError, NotYetHiredError } from './payslip.errors';

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
    const employee = await findEmployeeOrFail(this.employees, employeeId);
    if (employee.status !== 'ACTIVE') throw new EmployeeInactiveError();
    // ISO dates and YYYY-MM compare correctly as strings; the hire month counts in full.
    if (employee.hireDate.slice(0, 7) > month)
      throw new NotYetHiredError(month, employee.hireDate);

    const [taxTable, socialInsurance, { allowances, deductions }] =
      await Promise.all([
        resolveAppliedTaxTable(employee, this.taxTables),
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
              `${formatAmount(breakdown.deductionsUnapplied)} of deductions could not be applied`,
            ],
    };
  }
}
