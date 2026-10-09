import { Inject, Injectable } from '@nestjs/common';
import type { PayItems } from '@hr/types';
import { EmployeeNotFoundError } from '../../employees/employees.errors';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from '../../employees/employees.repository';
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
    await this.assertEmployeeExists(employeeId);
    return this.payItems.findByEmployee(employeeId);
  }

  async replace(employeeId: string, items: PayItems): Promise<PayItems> {
    await this.assertEmployeeExists(employeeId);
    return this.payItems.replaceForEmployee(employeeId, items);
  }

  private async assertEmployeeExists(employeeId: string): Promise<void> {
    if (!(await this.employees.findById(employeeId)))
      throw new EmployeeNotFoundError();
  }
}
