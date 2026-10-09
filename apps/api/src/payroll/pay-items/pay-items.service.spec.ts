import { NotFoundError } from '../../common/errors/domain-errors';
import {
  aDeletedEmployee,
  anEmployee,
} from '../../../test/fakes/employee.builder';
import { InMemoryEmployeeRepository } from '../../../test/fakes/in-memory-employee-repository';
import { InMemoryPayItemRepository } from '../../../test/fakes/in-memory-pay-item-repository';
import { somePayItems } from '../../../test/fakes/payroll.builder';
import { PayItemsService } from './pay-items.service';

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';

function setup(
  employee = anEmployee(),
  payItems = new InMemoryPayItemRepository(),
) {
  const service = new PayItemsService(
    payItems,
    new InMemoryEmployeeRepository([employee]),
  );
  return { service, employee, payItems };
}

describe('PayItemsService', () => {
  describe('get', () => {
    it('returns empty lists for an employee without items', async () => {
      const { service, employee } = setup();

      expect(await service.get(employee.id)).toEqual({
        allowances: [],
        deductions: [],
      });
    });

    it('returns stored allowances and deductions in order', async () => {
      const employee = anEmployee();
      const items = somePayItems({
        allowances: [
          { name: 'Transport', amount: '500.00' },
          { name: 'Housing', amount: '1000.00' },
        ],
        deductions: [{ name: 'Loan', amount: '200.00' }],
      });
      const { service } = setup(
        employee,
        new InMemoryPayItemRepository({ [employee.id]: items }),
      );

      expect(await service.get(employee.id)).toEqual(items);
    });

    it('throws NotFoundError for an unknown employee', async () => {
      const { service } = setup();

      await expect(service.get(UNKNOWN_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws NotFoundError for a deleted employee', async () => {
      const deleted = aDeletedEmployee();
      const { service } = setup(deleted);

      await expect(service.get(deleted.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('replace', () => {
    it('replaces both lists, keeping the given order and duplicate names', async () => {
      const employee = anEmployee();
      const { service, payItems } = setup(
        employee,
        new InMemoryPayItemRepository({
          [employee.id]: somePayItems({
            allowances: [{ name: 'Old', amount: '1.00' }],
            deductions: [{ name: 'Old', amount: '1.00' }],
          }),
        }),
      );
      const next = somePayItems({
        allowances: [
          { name: 'Z first', amount: '10.00' },
          { name: 'A second', amount: '20.00' },
        ],
        deductions: [
          { name: 'Loan', amount: '100.00' },
          { name: 'Loan', amount: '50.00' },
        ],
      });

      const result = await service.replace(employee.id, next);

      expect(result).toEqual(next);
      expect(await payItems.findByEmployee(employee.id)).toEqual(next);
    });

    it('can clear both lists', async () => {
      const employee = anEmployee();
      const { service } = setup(
        employee,
        new InMemoryPayItemRepository({
          [employee.id]: somePayItems({
            allowances: [{ name: 'Old', amount: '1.00' }],
          }),
        }),
      );

      expect(await service.replace(employee.id, somePayItems())).toEqual(
        somePayItems(),
      );
    });

    it('accepts hundreds of items (no count limit)', async () => {
      const { service, employee } = setup();
      const many = Array.from({ length: 300 }, (_, i) => ({
        name: `Item ${i}`,
        amount: '1.00',
      }));

      const result = await service.replace(
        employee.id,
        somePayItems({ allowances: many }),
      );

      expect(result.allowances).toHaveLength(300);
    });

    it('throws NotFoundError for an unknown employee and stores nothing', async () => {
      const { service, payItems } = setup();

      await expect(
        service.replace(UNKNOWN_ID, somePayItems()),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(await payItems.findByEmployee(UNKNOWN_ID)).toEqual(somePayItems());
    });

    it('throws NotFoundError for a deleted employee', async () => {
      const deleted = aDeletedEmployee();
      const { service } = setup(deleted);

      await expect(
        service.replace(deleted.id, somePayItems()),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
