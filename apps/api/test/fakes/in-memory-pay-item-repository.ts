import type { PayItems } from '@hr/types';
import type { PayItemRepository } from '../../src/payroll/pay-items/pay-items.repository';

export class InMemoryPayItemRepository implements PayItemRepository {
  private readonly byEmployee = new Map<string, PayItems>();

  constructor(seed: Record<string, PayItems> = {}) {
    for (const [employeeId, items] of Object.entries(seed))
      this.byEmployee.set(employeeId, clone(items));
  }

  async findByEmployee(employeeId: string): Promise<PayItems> {
    return clone(
      this.byEmployee.get(employeeId) ?? { allowances: [], deductions: [] },
    );
  }

  async replaceForEmployee(
    employeeId: string,
    items: PayItems,
  ): Promise<PayItems> {
    this.byEmployee.set(employeeId, clone(items));
    return clone(items);
  }
}

const clone = (items: PayItems): PayItems => ({
  allowances: items.allowances.map((i) => ({ ...i })),
  deductions: items.deductions.map((i) => ({ ...i })),
});
