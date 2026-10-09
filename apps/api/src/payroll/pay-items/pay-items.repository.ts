import type { PayItems } from '@hr/types';

export const PAY_ITEM_REPOSITORY = Symbol('PAY_ITEM_REPOSITORY');

export interface PayItemRepository {
  /** Items in their saved order. */
  findByEmployee(employeeId: string): Promise<PayItems>;
  /** Replaces both lists atomically. */
  replaceForEmployee(employeeId: string, items: PayItems): Promise<PayItems>;
}
