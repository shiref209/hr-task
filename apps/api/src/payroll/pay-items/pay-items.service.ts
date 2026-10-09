import { Inject, Injectable } from '@nestjs/common';
import type { PayItems } from '@hr/types';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from '../../employees/employees.repository';
import { findEmployeeOrFail } from '../../employees/find-employee-or-fail';
import {
  PAY_ITEM_REPOSITORY,
  type PayItemRepository,
} from './pay-items.repository';

@Injectable()
export class PayItemsService {
  constructor(
    @Inject(PAY_ITEM_REPOSITORY) private readonly payItems: PayItemRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
  ) {}

  async get(employeeId: string): Promise<PayItems> {
    await findEmployeeOrFail(this.employees, employeeId);
    return this.payItems.findByEmployee(employeeId);
  }

  async replace(employeeId: string, items: PayItems): Promise<PayItems> {
    await findEmployeeOrFail(this.employees, employeeId);
    return this.payItems.replaceForEmployee(employeeId, items);
  }
}
