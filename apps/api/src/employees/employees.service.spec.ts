import type { EmployeeListQuery } from '@hr/types';
import {
  UnsupportedMediaTypeError,
  ValidationError,
} from '../common/errors/domain-errors';
import { PaginatedResult } from '../common/http/paginated-result';
import {
  aCreateEmployeeInput,
  aDeletedEmployee,
  anActiveHr,
  anEmployee,
  ENGINEERING,
  FINANCE,
} from '../../test/fakes/employee.builder';
import { FixedClock } from '../../test/fakes/fixed-clock';
import { InMemoryDepartmentRepository } from '../../test/fakes/in-memory-department-repository';
import { InMemoryEmployeeRepository } from '../../test/fakes/in-memory-employee-repository';
import { InMemoryFileStorage } from '../../test/fakes/in-memory-file-storage';
import { InMemoryTaxTableRepository } from '../../test/fakes/in-memory-tax-table-repository';
import { aTaxTable } from '../../test/fakes/payroll.builder';
import {
  EmailAlreadyUsedError,
  EmployeeNotDeletedError,
  EmployeeNotFoundError,
  LastHrError,
} from './employees.errors';
import { EmployeesService } from './employees.service';
import type { Employee } from '@hr/types';

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';
const NOW = new Date('2026-10-08T10:00:00.000Z');

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const aPng = (): { buffer: Buffer; size: number } => {
  const buffer = Buffer.from([...PNG_HEADER, 0, 0, 0, 0]);
  return { buffer, size: buffer.length };
};
const aTextFile = (): { buffer: Buffer; size: number } => {
  const buffer = Buffer.from('definitely not an image');
  return { buffer, size: buffer.length };
};

function setup(seed: Employee[] = [], taxTables = [aTaxTable()]) {
  const employees = new InMemoryEmployeeRepository(
    seed,
    undefined,
    taxTables.map((t) => ({ id: t.id, name: t.name })),
  );
  const storage = new InMemoryFileStorage();
  const service = new EmployeesService(
    employees,
    new InMemoryDepartmentRepository(),
    new FixedClock(NOW),
    storage,
    new InMemoryTaxTableRepository(taxTables),
  );
  return { service, employees, storage, taxTables };
}

function aQuery(overrides: Partial<EmployeeListQuery> = {}): EmployeeListQuery {
  return { page: 1, pageSize: 20, deleted: false, ...overrides };
}

async function validationErrorOf(
  promise: Promise<unknown>,
): Promise<ValidationError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ValidationError) return e;
    throw e;
  }
  throw new Error('expected ValidationError, nothing thrown');
}

describe('EmployeesService', () => {
  describe('create', () => {
    it('stores the employee and returns it with the department embedded', async () => {
      const { service, employees } = setup();

      const created = await service.create(aCreateEmployeeInput());

      expect(created).toMatchObject({
        email: 'ada@example.com',
        baseSalary: '5000.00',
        department: ENGINEERING,
        deletedAt: null,
        profileImageUrl: null,
      });
      expect(await employees.findById(created.id)).not.toBeNull();
    });

    it('rejects an unknown department with a validation error on departmentId', async () => {
      const { service } = setup();

      const error = await validationErrorOf(
        service.create(aCreateEmployeeInput({ departmentId: UNKNOWN_ID })),
      );

      expect(error.errors).toEqual({
        departmentId: ['Department does not exist'],
      });
    });

    it('does not store anything when the department is unknown', async () => {
      const { service, employees } = setup();

      await expect(
        service.create(aCreateEmployeeInput({ departmentId: UNKNOWN_ID })),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(employees.all).toHaveLength(0);
    });

    it('rejects an email already used by an active employee', async () => {
      const { service } = setup([anEmployee({ email: 'ada@example.com' })]);

      const attempt = service.create(
        aCreateEmployeeInput({ email: 'ada@example.com' }),
      );

      await expect(attempt).rejects.toBeInstanceOf(EmailAlreadyUsedError);
    });

    it('does not mention restoring when the owner is active', async () => {
      const { service } = setup([anEmployee({ email: 'ada@example.com' })]);

      const attempt = service.create(
        aCreateEmployeeInput({ email: 'ada@example.com' }),
      );

      await expect(attempt).rejects.not.toThrow(/restore/i);
    });

    it('rejects an email owned by a deleted employee and says it can be restored', async () => {
      const { service } = setup([
        aDeletedEmployee({ email: 'ada@example.com' }),
      ]);

      const attempt = service.create(
        aCreateEmployeeInput({ email: 'ada@example.com' }),
      );

      await expect(attempt).rejects.toBeInstanceOf(EmailAlreadyUsedError);
      await expect(attempt).rejects.toThrow(/restore/i);
    });

    it('treats the email case-insensitively', async () => {
      const { service } = setup([anEmployee({ email: 'ada@example.com' })]);

      const attempt = service.create(
        aCreateEmployeeInput({ email: 'ADA@example.com' }),
      );

      await expect(attempt).rejects.toBeInstanceOf(EmailAlreadyUsedError);
    });
  });

  describe('list', () => {
    const fortyFive = () =>
      Array.from({ length: 45 }, (_, i) =>
        anEmployee({ fullName: `Person ${String(i).padStart(2, '0')}` }),
      );

    it('returns a PaginatedResult with the page slice and meta', async () => {
      const { service } = setup(fortyFive());

      const result = await service.list(aQuery({ page: 2, pageSize: 20 }));

      expect(result).toBeInstanceOf(PaginatedResult);
      expect(result.items).toHaveLength(20);
      expect(result.meta).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      });
    });

    it('returns a shorter last page', async () => {
      const { service } = setup(fortyFive());

      const result = await service.list(aQuery({ page: 3 }));

      expect(result.items).toHaveLength(5);
    });

    it('returns empty items with correct meta for a page beyond the last', async () => {
      const { service } = setup(fortyFive());

      const result = await service.list(aQuery({ page: 9 }));

      expect(result.items).toEqual([]);
      expect(result.meta).toEqual({
        page: 9,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      });
    });

    it('returns zero total pages when there are no employees', async () => {
      const { service } = setup();

      const result = await service.list(aQuery());

      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it('excludes deleted employees by default', async () => {
      const { service } = setup([anEmployee(), aDeletedEmployee()]);

      const result = await service.list(aQuery());

      expect(result.meta.totalItems).toBe(1);
    });

    it('returns only deleted employees when deleted is true', async () => {
      const deleted = aDeletedEmployee();
      const { service } = setup([anEmployee(), deleted]);

      const result = await service.list(aQuery({ deleted: true }));

      expect(result.items.map((e) => e.id)).toEqual([deleted.id]);
    });

    it('orders by full name', async () => {
      const { service } = setup([
        anEmployee({ fullName: 'Carl' }),
        anEmployee({ fullName: 'Ada' }),
        anEmployee({ fullName: 'Bob' }),
      ]);

      const result = await service.list(aQuery());

      expect(result.items.map((e) => e.fullName)).toEqual([
        'Ada',
        'Bob',
        'Carl',
      ]);
    });

    it('searches full name and email case-insensitively', async () => {
      const { service } = setup([
        anEmployee({ fullName: 'Ada Lovelace', email: 'a1@example.com' }),
        anEmployee({ fullName: 'Bob', email: 'ADA.fan@example.com' }),
        anEmployee({ fullName: 'Carl', email: 'carl@example.com' }),
      ]);

      const result = await service.list(aQuery({ search: 'ada' }));

      expect(result.items.map((e) => e.fullName).sort()).toEqual([
        'Ada Lovelace',
        'Bob',
      ]);
    });

    it('filters by exact department, status and type', async () => {
      const match = anEmployee({
        department: FINANCE,
        status: 'INACTIVE',
        type: 'HR',
      });
      const { service } = setup([
        match,
        anEmployee(),
        anEmployee({ department: FINANCE }),
      ]);

      const result = await service.list(
        aQuery({ departmentId: FINANCE.id, status: 'INACTIVE', type: 'HR' }),
      );

      expect(result.items.map((e) => e.id)).toEqual([match.id]);
    });
  });

  describe('getById', () => {
    it('returns the employee', async () => {
      const employee = anEmployee();
      const { service } = setup([employee]);

      expect(await service.getById(employee.id)).toEqual(employee);
    });

    it('rejects an unknown taxTableId with a validation error on taxTableId', async () => {
      const employee = anEmployee();
      const { service } = setup([employee]);

      const error = await validationErrorOf(
        service.update(employee.id, { taxTableId: UNKNOWN_ID }),
      );

      expect(error.errors).toEqual({ taxTableId: ['Select a tax table'] });
    });

    it('assigns an existing tax table and clears it with null', async () => {
      const employee = anEmployee();
      const { service, taxTables } = setup([employee]);

      const assigned = await service.update(employee.id, {
        taxTableId: taxTables[0].id,
      });
      const cleared = await service.update(employee.id, { taxTableId: null });

      expect(assigned.taxTable).toEqual({
        id: taxTables[0].id,
        name: taxTables[0].name,
      });
      expect(cleared.taxTable).toBeNull();
    });

    it('throws not found for an unknown id', async () => {
      const { service } = setup();

      await expect(service.getById(UNKNOWN_ID)).rejects.toBeInstanceOf(
        EmployeeNotFoundError,
      );
    });

    it('throws not found for a deleted employee', async () => {
      const deleted = aDeletedEmployee();
      const { service } = setup([deleted]);

      await expect(service.getById(deleted.id)).rejects.toBeInstanceOf(
        EmployeeNotFoundError,
      );
    });
  });

  describe('update', () => {
    it('applies a partial change and keeps other fields', async () => {
      const employee = anEmployee({ jobTitle: 'Engineer' });
      const { service } = setup([employee]);

      const updated = await service.update(employee.id, {
        fullName: 'New Name',
      });

      expect(updated).toMatchObject({
        fullName: 'New Name',
        jobTitle: 'Engineer',
        email: employee.email,
      });
    });

    it('clears the phone when null is given', async () => {
      const employee = anEmployee({ phone: '+201001234567' });
      const { service } = setup([employee]);

      const updated = await service.update(employee.id, { phone: null });

      expect(updated.phone).toBeNull();
    });

    it('rejects an email used by another employee', async () => {
      const other = anEmployee({ email: 'other@example.com' });
      const employee = anEmployee();
      const { service } = setup([employee, other]);

      await expect(
        service.update(employee.id, { email: 'other@example.com' }),
      ).rejects.toBeInstanceOf(EmailAlreadyUsedError);
    });

    it('rejects an email owned by a deleted employee', async () => {
      const gone = aDeletedEmployee({ email: 'gone@example.com' });
      const employee = anEmployee();
      const { service } = setup([employee, gone]);

      await expect(
        service.update(employee.id, { email: 'gone@example.com' }),
      ).rejects.toThrow(/restore/i);
    });

    it('accepts the employee own email', async () => {
      const employee = anEmployee({ email: 'me@example.com' });
      const { service } = setup([employee]);

      const updated = await service.update(employee.id, {
        email: 'me@example.com',
        fullName: 'Renamed',
      });

      expect(updated.fullName).toBe('Renamed');
    });

    it('moves the employee to another existing department', async () => {
      const employee = anEmployee();
      const { service } = setup([employee]);

      const updated = await service.update(employee.id, {
        departmentId: FINANCE.id,
      });

      expect(updated.department).toEqual(FINANCE);
    });

    it('rejects an unknown department with a validation error on departmentId', async () => {
      const employee = anEmployee();
      const { service } = setup([employee]);

      const error = await validationErrorOf(
        service.update(employee.id, { departmentId: UNKNOWN_ID }),
      );

      expect(error.errors).toEqual({
        departmentId: ['Department does not exist'],
      });
    });

    it('throws not found for an unknown id', async () => {
      const { service } = setup();

      await expect(
        service.update(UNKNOWN_ID, { fullName: 'X' }),
      ).rejects.toBeInstanceOf(EmployeeNotFoundError);
    });

    it('throws not found for a deleted employee', async () => {
      const deleted = aDeletedEmployee();
      const { service } = setup([deleted]);

      await expect(
        service.update(deleted.id, { fullName: 'X' }),
      ).rejects.toBeInstanceOf(EmployeeNotFoundError);
    });
  });

  describe('remove', () => {
    it('soft-deletes using the clock time', async () => {
      const employee = anEmployee();
      const { service, employees } = setup([employee]);

      await service.remove(employee.id);

      const stored = await employees.findById(employee.id, {
        includeDeleted: true,
      });
      expect(stored?.deletedAt).toBe(NOW.toISOString());
    });

    it('hides the employee from getById afterwards', async () => {
      const employee = anEmployee();
      const { service } = setup([employee]);

      await service.remove(employee.id);

      await expect(service.getById(employee.id)).rejects.toBeInstanceOf(
        EmployeeNotFoundError,
      );
    });

    it('keeps the profile image file', async () => {
      const employee = anEmployee({
        profileImageUrl: '/uploads/employees/a.png',
      });
      const { service, storage } = setup([employee]);

      await service.remove(employee.id);

      expect(storage.removed).toEqual([]);
    });

    it('throws not found for an unknown id', async () => {
      const { service } = setup();

      await expect(service.remove(UNKNOWN_ID)).rejects.toBeInstanceOf(
        EmployeeNotFoundError,
      );
    });

    it('throws not found for an already-deleted employee', async () => {
      const deleted = aDeletedEmployee();
      const { service } = setup([deleted]);

      await expect(service.remove(deleted.id)).rejects.toBeInstanceOf(
        EmployeeNotFoundError,
      );
    });
  });

  describe('restore', () => {
    it('clears deletedAt and returns the employee', async () => {
      const deleted = aDeletedEmployee();
      const { service, employees } = setup([deleted]);

      const restored = await service.restore(deleted.id);

      expect(restored.deletedAt).toBeNull();
      expect(await employees.findById(deleted.id)).not.toBeNull();
    });

    it('rejects restoring an employee that is not deleted', async () => {
      const employee = anEmployee();
      const { service } = setup([employee]);

      await expect(service.restore(employee.id)).rejects.toBeInstanceOf(
        EmployeeNotDeletedError,
      );
    });

    it('throws not found for an unknown id', async () => {
      const { service } = setup();

      await expect(service.restore(UNKNOWN_ID)).rejects.toBeInstanceOf(
        EmployeeNotFoundError,
      );
    });
  });

  describe('last-HR guard', () => {
    describe('with exactly one active HR', () => {
      it('blocks deleting them', async () => {
        const hr = anActiveHr();
        const { service, employees } = setup([hr]);

        await expect(service.remove(hr.id)).rejects.toBeInstanceOf(LastHrError);
        expect((await employees.findById(hr.id))?.deletedAt).toBeNull();
      });

      it('blocks deactivating them', async () => {
        const hr = anActiveHr();
        const { service, employees } = setup([hr]);

        await expect(
          service.update(hr.id, { status: 'INACTIVE' }),
        ).rejects.toBeInstanceOf(LastHrError);
        expect((await employees.findById(hr.id))?.status).toBe('ACTIVE');
      });

      it('blocks demoting them to EMPLOYEE', async () => {
        const hr = anActiveHr();
        const { service, employees } = setup([hr]);

        await expect(
          service.update(hr.id, { type: 'EMPLOYEE' }),
        ).rejects.toBeInstanceOf(LastHrError);
        expect((await employees.findById(hr.id))?.type).toBe('HR');
      });

      it('allows unrelated edits to them', async () => {
        const hr = anActiveHr();
        const { service } = setup([hr]);

        const updated = await service.update(hr.id, { fullName: 'Renamed HR' });

        expect(updated.fullName).toBe('Renamed HR');
      });

      it('allows no-op status and type values on them', async () => {
        const hr = anActiveHr();
        const { service } = setup([hr]);

        const updated = await service.update(hr.id, {
          status: 'ACTIVE',
          type: 'HR',
        });

        expect(updated).toMatchObject({ status: 'ACTIVE', type: 'HR' });
      });
    });

    describe('with two active HRs', () => {
      it('allows deleting the first and blocks deleting the second', async () => {
        const [first, second] = [anActiveHr(), anActiveHr()];
        const { service } = setup([first, second]);

        await service.remove(first.id);

        await expect(service.remove(second.id)).rejects.toBeInstanceOf(
          LastHrError,
        );
      });

      it('allows deactivating the first and blocks deactivating the second', async () => {
        const [first, second] = [anActiveHr(), anActiveHr()];
        const { service } = setup([first, second]);

        await service.update(first.id, { status: 'INACTIVE' });

        await expect(
          service.update(second.id, { status: 'INACTIVE' }),
        ).rejects.toBeInstanceOf(LastHrError);
      });

      it('allows demoting the first and blocks demoting the second', async () => {
        const [first, second] = [anActiveHr(), anActiveHr()];
        const { service } = setup([first, second]);

        await service.update(first.id, { type: 'EMPLOYEE' });

        await expect(
          service.update(second.id, { type: 'EMPLOYEE' }),
        ).rejects.toBeInstanceOf(LastHrError);
      });
    });

    describe('who counts as an admin', () => {
      it('does not count an INACTIVE HR', async () => {
        const active = anActiveHr();
        const inactive = anActiveHr({ status: 'INACTIVE' });
        const { service } = setup([active, inactive]);

        await expect(service.remove(active.id)).rejects.toBeInstanceOf(
          LastHrError,
        );
      });

      it('does not count a deleted HR', async () => {
        const active = anActiveHr();
        const deleted = aDeletedEmployee({ type: 'HR', status: 'ACTIVE' });
        const { service } = setup([active, deleted]);

        await expect(service.remove(active.id)).rejects.toBeInstanceOf(
          LastHrError,
        );
      });

      it('allows deleting an INACTIVE HR while one active HR remains', async () => {
        const active = anActiveHr();
        const inactive = anActiveHr({ status: 'INACTIVE' });
        const { service } = setup([active, inactive]);

        await expect(service.remove(inactive.id)).resolves.toBeUndefined();
      });

      it('allows deleting a non-HR employee when only one HR exists', async () => {
        const employee = anEmployee();
        const { service } = setup([anActiveHr(), employee]);

        await expect(service.remove(employee.id)).resolves.toBeUndefined();
      });

      it('allows deactivating a non-HR employee when only one HR exists', async () => {
        const employee = anEmployee();
        const { service } = setup([anActiveHr(), employee]);

        const updated = await service.update(employee.id, {
          status: 'INACTIVE',
        });

        expect(updated.status).toBe('INACTIVE');
      });

      it('allows promoting an employee to HR', async () => {
        const employee = anEmployee();
        const { service } = setup([employee]);

        const updated = await service.update(employee.id, { type: 'HR' });

        expect(updated.type).toBe('HR');
      });
    });
  });

  describe('setProfileImage', () => {
    it('saves the file, stores its url on the employee and returns it', async () => {
      const employee = anEmployee();
      const { service, storage, employees } = setup([employee]);

      const updated = await service.setProfileImage(employee.id, aPng());

      expect(storage.saved).toHaveLength(1);
      expect(updated.profileImageUrl).toBe(storage.saved[0].url);
      expect((await employees.findById(employee.id))?.profileImageUrl).toBe(
        storage.saved[0].url,
      );
    });

    it('uses the signature-derived extension', async () => {
      const employee = anEmployee();
      const { service, storage } = setup([employee]);

      await service.setProfileImage(employee.id, aPng());

      expect(storage.saved[0].extension).toBe('png');
    });

    it('removes nothing on a first upload', async () => {
      const employee = anEmployee({ profileImageUrl: null });
      const { service, storage } = setup([employee]);

      await service.setProfileImage(employee.id, aPng());

      expect(storage.removed).toEqual([]);
    });

    it('saves the new file, updates the record, then removes the old file', async () => {
      const employee = anEmployee({
        profileImageUrl: '/uploads/employees/old.png',
      });
      const { service, storage, employees } = setup([employee]);
      const events: string[] = [];
      storage.log = events;
      employees.log = events;

      await service.setProfileImage(employee.id, aPng());

      expect(events).toEqual(['save', 'update', 'remove']);
      expect(storage.removed).toEqual(['/uploads/employees/old.png']);
    });

    it('throws not found and saves nothing for an unknown employee', async () => {
      const { service, storage } = setup();

      await expect(
        service.setProfileImage(UNKNOWN_ID, aPng()),
      ).rejects.toBeInstanceOf(EmployeeNotFoundError);
      expect(storage.saved).toEqual([]);
    });

    it('throws not found and saves nothing for a deleted employee', async () => {
      const deleted = aDeletedEmployee();
      const { service, storage } = setup([deleted]);

      await expect(
        service.setProfileImage(deleted.id, aPng()),
      ).rejects.toBeInstanceOf(EmployeeNotFoundError);
      expect(storage.saved).toEqual([]);
    });

    it('rejects a file with an unknown signature and saves nothing', async () => {
      const employee = anEmployee();
      const { service, storage } = setup([employee]);

      await expect(
        service.setProfileImage(employee.id, aTextFile()),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
      expect(storage.saved).toEqual([]);
    });

    it('keeps the old image when the new file is rejected', async () => {
      const employee = anEmployee({
        profileImageUrl: '/uploads/employees/old.png',
      });
      const { service, storage, employees } = setup([employee]);

      await expect(
        service.setProfileImage(employee.id, aTextFile()),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
      expect(storage.removed).toEqual([]);
      expect((await employees.findById(employee.id))?.profileImageUrl).toBe(
        '/uploads/employees/old.png',
      );
    });
  });
});
