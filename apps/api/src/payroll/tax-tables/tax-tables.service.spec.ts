import type { Employee, TaxTableInput } from '@hr/types';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/domain-errors';
import {
  aDefaultTaxTable,
  aSocialInsurance,
  aTaxTable,
} from '../../../test/fakes/payroll.builder';
import {
  aDeletedEmployee,
  anEmployee,
} from '../../../test/fakes/employee.builder';
import { InMemoryEmployeeRepository } from '../../../test/fakes/in-memory-employee-repository';
import { InMemorySocialInsuranceRepository } from '../../../test/fakes/in-memory-social-insurance-repository';
import { InMemoryTaxTableRepository } from '../../../test/fakes/in-memory-tax-table-repository';
import { TaxTablesService } from './tax-tables.service';

const ref = (t: { id: string; name: string }) => ({ id: t.id, name: t.name });
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';

function anInput(overrides: Partial<TaxTableInput> = {}): TaxTableInput {
  return {
    name: 'Exempt',
    brackets: [{ upTo: null, rate: '0' }],
    ...overrides,
  };
}

function setup(
  seed = [aDefaultTaxTable({ name: 'Standard' })],
  employeeSeed: Employee[] = [],
  insuranceRate = '11.00',
) {
  const employees = new InMemoryEmployeeRepository(employeeSeed);
  const repository = new InMemoryTaxTableRepository(seed, employees);
  const service = new TaxTablesService(
    repository,
    new InMemorySocialInsuranceRepository(
      aSocialInsurance({ rate: insuranceRate }),
    ),
  );
  return { service, repository, employees };
}

describe('TaxTablesService', () => {
  describe('list', () => {
    it('returns the default table first with its employee count', async () => {
      const other = aTaxTable({ name: 'Aaa' });
      const standard = aDefaultTaxTable({ name: 'Zzz' });
      const { service } = setup(
        [other, standard],
        [1, 2, 3, 4].map(() => anEmployee({ taxTable: ref(standard) })),
      );

      const tables = await service.list();

      expect(tables.map((t) => t.name)).toEqual(['Zzz', 'Aaa']);
      expect(tables[0].employeeCount).toBe(4);
    });
  });

  describe('create', () => {
    it('stores the table as a non-default and returns it with an id', async () => {
      const { service, repository } = setup();

      const created = await service.create(anInput());

      expect(created).toMatchObject({ name: 'Exempt', isDefault: false });
      expect(created.id).toEqual(expect.any(String));
      expect(repository.all).toHaveLength(2);
      expect(repository.all.filter((t) => t.isDefault)).toHaveLength(1);
    });

    it('rejects a name used by another table, ignoring case, with 409 semantics', async () => {
      const { service, repository } = setup();

      await expect(
        service.create(anInput({ name: 'STANDARD' })),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.all).toHaveLength(1);
    });

    it('rejects a highest bracket rate that pushes tax + insurance above 100 (edge case 14)', async () => {
      const { service, repository } = setup(undefined, [], '11.00');

      await expect(
        service.create(anInput({ brackets: [{ upTo: null, rate: '89.01' }] })),
      ).rejects.toBeInstanceOf(BusinessRuleError);
      expect(repository.all).toHaveLength(1);
    });

    it('accepts a highest bracket rate that makes the total exactly 100', async () => {
      const { service } = setup(undefined, [], '11.00');

      await expect(
        service.create(anInput({ brackets: [{ upTo: null, rate: '89' }] })),
      ).resolves.toMatchObject({ name: 'Exempt' });
    });

    it('uses the highest rate among all brackets, not the last one', async () => {
      const { service } = setup(undefined, [], '11.00');

      await expect(
        service.create(
          anInput({
            brackets: [
              { upTo: '1000', rate: '95' },
              { upTo: null, rate: '5' },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });
  });

  describe('update', () => {
    it('replaces the name and the brackets', async () => {
      const table = aTaxTable({ name: 'Old' });
      const { service, repository } = setup([aDefaultTaxTable(), table]);

      const updated = await service.update(
        table.id,
        anInput({
          name: 'New',
          brackets: [
            { upTo: '500', rate: '1' },
            { upTo: null, rate: '2' },
          ],
        }),
      );

      expect(updated).toMatchObject({
        id: table.id,
        name: 'New',
        brackets: [
          { upTo: '500.00', rate: '1.00' },
          { upTo: null, rate: '2.00' },
        ],
      });
      expect((await repository.findById(table.id))?.name).toBe('New');
    });

    it('allows saving a table under its own name with different casing', async () => {
      const table = aDefaultTaxTable({ name: 'Standard' });
      const { service } = setup([table]);

      await expect(
        service.update(table.id, anInput({ name: 'standard' })),
      ).resolves.toMatchObject({ name: 'standard' });
    });

    it('rejects a name used by another table, ignoring case', async () => {
      const table = aTaxTable({ name: 'Mine' });
      const { service } = setup([
        aDefaultTaxTable({ name: 'Standard' }),
        table,
      ]);

      await expect(
        service.update(table.id, anInput({ name: 'sTaNdArD' })),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a rate ceiling violation and leaves the table unchanged', async () => {
      const table = aDefaultTaxTable({ name: 'Standard' });
      const { service, repository } = setup([table], [], '50.00');

      await expect(
        service.update(
          table.id,
          anInput({
            name: 'Standard',
            brackets: [{ upTo: null, rate: '50.01' }],
          }),
        ),
      ).rejects.toBeInstanceOf(BusinessRuleError);
      expect((await repository.findById(table.id))?.brackets).toEqual(
        table.brackets,
      );
    });

    it('throws NotFoundError for an unknown table', async () => {
      const { service } = setup();

      await expect(
        service.update(UNKNOWN_ID, anInput()),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('setDefault', () => {
    it('makes the table the only default in one repository operation', async () => {
      const old = aDefaultTaxTable({ name: 'Standard' });
      const next = aTaxTable({ name: 'Next' });
      const { service, repository } = setup([old, next]);

      const result = await service.setDefault(next.id);

      expect(result).toMatchObject({ id: next.id, isDefault: true });
      expect(
        repository.all.filter((t) => t.isDefault).map((t) => t.id),
      ).toEqual([next.id]);
      expect(repository.log).toEqual(['setDefault']);
    });

    it('is a no-op success for the current default', async () => {
      const current = aDefaultTaxTable();
      const { service, repository } = setup([current]);

      await expect(service.setDefault(current.id)).resolves.toMatchObject({
        isDefault: true,
      });
      expect(repository.all.filter((t) => t.isDefault)).toHaveLength(1);
    });

    it('throws NotFoundError for an unknown table and keeps the default', async () => {
      const { service, repository } = setup();

      await expect(service.setDefault(UNKNOWN_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repository.all.filter((t) => t.isDefault)).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('deletes an unassigned non-default table', async () => {
      const table = aTaxTable({ name: 'Unused' });
      const { service, repository } = setup([aDefaultTaxTable(), table]);

      await service.delete(table.id);

      expect(await repository.findById(table.id)).toBeNull();
    });

    it('rejects deleting the default table and tells HR to choose another default', async () => {
      const current = aDefaultTaxTable();
      const { service, repository } = setup([current]);

      const failure = service.delete(current.id);

      await expect(failure).rejects.toBeInstanceOf(ConflictError);
      await expect(failure).rejects.toThrow(/choose another default first/i);
      expect(repository.log).not.toContain('delete');
    });

    it('rejects deleting a table assigned to employees, naming the count', async () => {
      const table = aTaxTable({ name: 'Used' });
      const { service, repository } = setup(
        [aDefaultTaxTable(), table],
        [1, 2, 3].map(() => anEmployee({ taxTable: ref(table) })),
      );

      const failure = service.delete(table.id);

      await expect(failure).rejects.toBeInstanceOf(ConflictError);
      await expect(failure).rejects.toThrow(/Used by 3 employees/);
      expect(await repository.findById(table.id)).not.toBeNull();
    });

    it('deletes a table held only by deleted employees and clears their assignment (edge case 7)', async () => {
      const table = aTaxTable({ name: 'Old' });
      const gone = aDeletedEmployee({ taxTable: ref(table) });
      const { service, repository, employees } = setup(
        [aDefaultTaxTable(), table],
        [gone],
      );

      await service.delete(table.id);

      expect(await repository.findById(table.id)).toBeNull();
      expect(
        (await employees.findById(gone.id, { includeDeleted: true }))?.taxTable,
      ).toBeNull();
    });

    it('counts only non-deleted employees when blocking a delete', async () => {
      const table = aTaxTable({ name: 'Mixed' });
      const { service, repository } = setup(
        [aDefaultTaxTable(), table],
        [
          anEmployee({ taxTable: ref(table) }),
          aDeletedEmployee({ taxTable: ref(table) }),
        ],
      );

      const failure = service.delete(table.id);

      await expect(failure).rejects.toBeInstanceOf(ConflictError);
      await expect(failure).rejects.toThrow(/Used by 1 employee\b/);
      expect(await repository.findById(table.id)).not.toBeNull();
    });

    it('throws NotFoundError for an unknown table', async () => {
      const { service } = setup();

      await expect(service.delete(UNKNOWN_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
