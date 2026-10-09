import type { Employee, PayItems, SocialInsurance, TaxTable } from '@hr/types';
import {
  BusinessRuleError,
  NotFoundError,
} from '../../common/errors/domain-errors';
import {
  aDeletedEmployee,
  anEmployee,
} from '../../../test/fakes/employee.builder';
import { InMemoryEmployeeRepository } from '../../../test/fakes/in-memory-employee-repository';
import { InMemoryPayItemRepository } from '../../../test/fakes/in-memory-pay-item-repository';
import { InMemorySocialInsuranceRepository } from '../../../test/fakes/in-memory-social-insurance-repository';
import { InMemoryTaxTableRepository } from '../../../test/fakes/in-memory-tax-table-repository';
import {
  aDefaultTaxTable,
  aSocialInsurance,
  aTaxTable,
  somePayItems,
} from '../../../test/fakes/payroll.builder';
import { PayslipService } from './payslip.service';

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';

function setup(
  employee: Employee,
  options: {
    tables?: TaxTable[];
    insurance?: SocialInsurance;
    items?: PayItems;
  } = {},
) {
  const taxTables = new InMemoryTaxTableRepository(
    options.tables ?? [aDefaultTaxTable({ name: 'Standard' })],
  );
  const service = new PayslipService(
    new InMemoryEmployeeRepository([employee]),
    taxTables,
    new InMemorySocialInsuranceRepository(
      options.insurance ?? aSocialInsurance(),
    ),
    new InMemoryPayItemRepository(
      options.items ? { [employee.id]: options.items } : {},
    ),
  );
  return { service, taxTables };
}

describe('PayslipService', () => {
  describe('payslip content', () => {
    it('builds the 25,000 worked example from employee, default table, insurance and pay items', async () => {
      const employee = anEmployee({
        fullName: 'Ada Lovelace',
        baseSalary: '25000.00',
        hireDate: '2024-01-15',
      });
      const standard = aDefaultTaxTable({ name: 'Standard' });
      const { service } = setup(employee, {
        tables: [standard],
        items: somePayItems({
          allowances: [
            { name: 'Transport', amount: '1000.00' },
            { name: 'Housing', amount: '500.00' },
          ],
          deductions: [{ name: 'Loan', amount: '500.00' }],
        }),
      });

      const slip = await service.generate(employee.id, '2026-10');

      expect(slip).toMatchObject({
        employee: { id: employee.id, fullName: 'Ada Lovelace' },
        month: '2026-10',
        taxTable: { id: standard.id, name: 'Standard' },
        baseSalary: '25000.00',
        allowances: [
          { name: 'Transport', amount: '1000.00' },
          { name: 'Housing', amount: '500.00' },
        ],
        allowancesTotal: '1500.00',
        gross: '26500.00',
        tax: { total: '1750.00', effectiveRate: '7.00' },
        socialInsurance: {
          rate: '11.00',
          cap: '2000.00',
          amount: '2000.00',
          capped: true,
        },
        deductions: [{ name: 'Loan', requested: '500.00', applied: '500.00' }],
        deductionsApplied: '500.00',
        deductionsUnapplied: '0.00',
        net: '22250.00',
        warnings: [],
      });
      expect(slip.tax.brackets).toHaveLength(3);
    });

    it('uses the employee tax table override instead of the default', async () => {
      const exempt = aTaxTable({
        name: 'Exempt',
        brackets: [{ upTo: null, rate: '0.00' }],
      });
      const employee = anEmployee({
        baseSalary: '25000.00',
        taxTable: { id: exempt.id, name: exempt.name },
      });
      const { service } = setup(employee, {
        tables: [aDefaultTaxTable(), exempt],
      });

      const slip = await service.generate(employee.id, '2026-10');

      expect(slip.taxTable).toEqual({ id: exempt.id, name: 'Exempt' });
      expect(slip.tax.total).toBe('0.00');
    });

    it('follows a change of default for employees without an override (edge case 8)', async () => {
      const employee = anEmployee({ baseSalary: '20000.00' });
      const standard = aDefaultTaxTable({ name: 'Standard' });
      const exempt = aTaxTable({
        name: 'Exempt',
        brackets: [{ upTo: null, rate: '0.00' }],
      });
      const { service, taxTables } = setup(employee, {
        tables: [standard, exempt],
      });

      const before = await service.generate(employee.id, '2026-10');
      await taxTables.setDefault(exempt.id);
      const after = await service.generate(employee.id, '2026-10');

      expect(before.tax.total).toBe('1000.00');
      expect(after.taxTable.name).toBe('Exempt');
      expect(after.tax.total).toBe('0.00');
    });

    it('gross equals base when there are no pay items (edge case 12)', async () => {
      const employee = anEmployee({ baseSalary: '5000.00' });
      const { service } = setup(employee);

      const slip = await service.generate(employee.id, '2026-10');

      expect(slip).toMatchObject({
        allowances: [],
        deductions: [],
        gross: '5000.00',
        deductionsApplied: '0.00',
        net: '4450.00',
        warnings: [],
      });
    });

    it('warns with the unapplied amount when deductions exceed what is left (edge case 13)', async () => {
      const employee = anEmployee({ baseSalary: '5000.00' });
      const { service } = setup(employee, {
        items: somePayItems({
          deductions: [{ name: 'Big loan', amount: '6000.00' }],
        }),
      });

      const slip = await service.generate(employee.id, '2026-10');

      expect(slip.net).toBe('0.00');
      expect(slip.deductionsUnapplied).toBe('1550.00');
      expect(slip.warnings).toEqual([
        '1,550.00 of deductions could not be applied',
      ]);
    });
  });

  describe('month rules', () => {
    it('rejects a month before the hire month with 422 naming the month (edge case 17)', async () => {
      const employee = anEmployee({ hireDate: '2026-03-15' });
      const { service } = setup(employee);

      const failure = service.generate(employee.id, '2026-02');

      await expect(failure).rejects.toBeInstanceOf(BusinessRuleError);
      await expect(failure).rejects.toThrow(
        'Not yet hired in 2026-02 (hire date 2026-03-15)',
      );
    });

    it('treats the hire month as a full month, even when hired on its last day', async () => {
      const employee = anEmployee({ hireDate: '2026-03-31' });
      const { service } = setup(employee);

      const slip = await service.generate(employee.id, '2026-03');

      expect(slip.month).toBe('2026-03');
      expect(slip.baseSalary).toBe(employee.baseSalary);
    });

    it('allows future months as a preview (edge case 19)', async () => {
      const employee = anEmployee();
      const { service } = setup(employee);

      await expect(
        service.generate(employee.id, '2035-12'),
      ).resolves.toMatchObject({ month: '2035-12' });
    });
  });

  describe('employee state', () => {
    it('rejects an inactive employee with 422 semantics (edge case 18)', async () => {
      const employee = anEmployee({ status: 'INACTIVE' });
      const { service } = setup(employee);

      await expect(
        service.generate(employee.id, '2026-10'),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });

    it('throws NotFoundError for a deleted employee', async () => {
      const employee = aDeletedEmployee();
      const { service } = setup(employee);

      await expect(
        service.generate(employee.id, '2026-10'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError for an unknown employee', async () => {
      const { service } = setup(anEmployee());

      await expect(
        service.generate(UNKNOWN_ID, '2026-10'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
