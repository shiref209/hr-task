import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProblemType } from '@hr/types';
import type { Employee } from '@hr/types';
import { CLOCK } from '../src/common/clock';
import { configureApp } from '../src/configure-app';
import { DepartmentsModule } from '../src/departments/departments.module';
import { DEPARTMENT_REPOSITORY } from '../src/departments/departments.repository';
import { EmployeesModule } from '../src/employees/employees.module';
import { EMPLOYEE_REPOSITORY } from '../src/employees/employees.repository';
import { FILE_STORAGE } from '../src/employees/profile-image/file-storage';
import {
  aDeletedEmployee,
  anActiveHr,
  anEmployee,
  ENGINEERING,
  FINANCE,
  HUMAN_RESOURCES,
} from './fakes/employee.builder';
import { FixedClock } from './fakes/fixed-clock';
import { InMemoryDepartmentRepository } from './fakes/in-memory-department-repository';
import { InMemoryEmployeeRepository } from './fakes/in-memory-employee-repository';
import { InMemoryFileStorage } from './fakes/in-memory-file-storage';
import { TAX_TABLE_REPOSITORY } from '../src/payroll/tax-tables/tax-tables.repository';
import { SOCIAL_INSURANCE_REPOSITORY } from '../src/payroll/social-insurance/social-insurance.repository';
import { InMemoryTaxTableRepository } from './fakes/in-memory-tax-table-repository';
import { InMemorySocialInsuranceRepository } from './fakes/in-memory-social-insurance-repository';

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';
const TWO_MB = 2 * 1024 * 1024;
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const pngOfSize = (size: number) =>
  Buffer.concat([PNG_HEADER, Buffer.alloc(size - PNG_HEADER.length)]);

// The schema compares against the runtime's local date; compute it the same way
// (real clock, no fake timers, which would stall Nest/Supertest I/O).
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    jobTitle: 'Engineer',
    departmentId: ENGINEERING.id,
    hireDate: '2024-01-15',
    baseSalary: '5000.00',
    ...overrides,
  };
}

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let storage: InMemoryFileStorage;
  const http = () => request(app.getHttpServer());

  async function boot(seed: Employee[] = []) {
    storage = new InMemoryFileStorage();
    const moduleRef = await Test.createTestingModule({
      imports: [EmployeesModule, DepartmentsModule],
    })
      .overrideProvider(TAX_TABLE_REPOSITORY)
      .useValue(new InMemoryTaxTableRepository())
      .overrideProvider(SOCIAL_INSURANCE_REPOSITORY)
      .useValue(new InMemorySocialInsuranceRepository())
      .overrideProvider(EMPLOYEE_REPOSITORY)
      .useValue(new InMemoryEmployeeRepository(seed))
      .overrideProvider(DEPARTMENT_REPOSITORY)
      .useValue(
        new InMemoryDepartmentRepository([
          HUMAN_RESOURCES,
          FINANCE,
          ENGINEERING,
        ]),
      )
      .overrideProvider(FILE_STORAGE)
      .useValue(storage)
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(new Date('2026-10-08T10:00:00.000Z')))
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  }

  afterEach(async () => {
    await app.close();
  });

  describe('POST /employees', () => {
    it('returns 201 with the created employee in the envelope', async () => {
      await boot();

      const res = await http()
        .post('/employees')
        .send(validBody({ phone: '+20 100 123 4567' }))
        .expect(201);

      expect(res.body.data).toMatchObject({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+201001234567',
        baseSalary: '5000.00',
        department: { id: ENGINEERING.id, name: 'Engineering' },
        status: 'ACTIVE',
        type: 'EMPLOYEE',
        profileImageUrl: null,
        deletedAt: null,
      });
      expect(res.body.data.id).toEqual(expect.any(String));
      expect(res.body.meta).toBeUndefined();
    });

    it('returns 400 with every failing field and unknown keys in the errors map', async () => {
      await boot();

      const res = await http()
        .post('/employees')
        .send(validBody({ fullName: '   ', email: 'nope', foo: 1 }))
        .expect(400);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({
        type: ProblemType.validationError,
        status: 400,
        instance: '/employees',
      });
      expect(Object.keys(res.body.errors).sort()).toEqual([
        'email',
        'foo',
        'fullName',
      ]);
      expect(res.body.errors.foo).toEqual(['Unknown field']);
    });

    it('returns 400 for a numeric baseSalary', async () => {
      await boot();

      const res = await http()
        .post('/employees')
        .send(validBody({ baseSalary: 5000 }))
        .expect(400);

      expect(res.body.errors).toHaveProperty('baseSalary');
    });

    it('returns 400 with errors.hireDate for a future hire date', async () => {
      await boot();

      const res = await http()
        .post('/employees')
        .send(validBody({ hireDate: '2030-06-01' }))
        .expect(400);

      expect(res.body.errors).toHaveProperty('hireDate');
    });

    it('accepts a hire date equal to today (local date)', async () => {
      await boot();

      await http()
        .post('/employees')
        .send(validBody({ hireDate: localToday() }))
        .expect(201);
    });

    it('returns 400 for a non-existent hire date', async () => {
      await boot();

      const res = await http()
        .post('/employees')
        .send(validBody({ hireDate: '2026-02-30' }))
        .expect(400);

      expect(res.body.errors).toHaveProperty('hireDate');
    });

    it('returns 400 on departmentId for an unknown department', async () => {
      await boot();

      const res = await http()
        .post('/employees')
        .send(validBody({ departmentId: UNKNOWN_ID }))
        .expect(400);

      expect(res.body.errors).toEqual({
        departmentId: ['Department does not exist'],
      });
    });

    it('returns 409 for an email already used, ignoring case', async () => {
      await boot([anEmployee({ email: 'ada@example.com' })]);

      const res = await http()
        .post('/employees')
        .send(validBody({ email: 'ADA@Example.com' }))
        .expect(409);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({
        type: ProblemType.conflict,
        status: 409,
      });
    });

    it('returns 409 mentioning restore when the email belongs to a deleted employee', async () => {
      await boot([aDeletedEmployee({ email: 'ada@example.com' })]);

      const res = await http().post('/employees').send(validBody()).expect(409);

      expect(res.body.detail).toMatch(/restore/i);
    });
  });

  describe('GET /employees', () => {
    it('returns 200 with employees ordered by name and pagination meta', async () => {
      await boot([
        anEmployee({ fullName: 'Carl' }),
        anEmployee({ fullName: 'Ada' }),
        anEmployee({ fullName: 'Bob' }),
      ]);

      const res = await http().get('/employees').expect(200);

      expect(res.body.data.map((e: Employee) => e.fullName)).toEqual([
        'Ada',
        'Bob',
        'Carl',
      ]);
      expect(res.body.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 3,
        totalPages: 1,
      });
    });

    it('paginates with page and pageSize', async () => {
      await boot([
        anEmployee({ fullName: 'A' }),
        anEmployee({ fullName: 'B' }),
        anEmployee({ fullName: 'C' }),
      ]);

      const res = await http().get('/employees?page=2&pageSize=2').expect(200);

      expect(res.body.data.map((e: Employee) => e.fullName)).toEqual(['C']);
      expect(res.body.meta).toEqual({
        page: 2,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2,
      });
    });

    it('returns 200 with empty data for a page beyond the last', async () => {
      await boot([anEmployee()]);

      const res = await http().get('/employees?page=5').expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toEqual({
        page: 5,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      });
    });

    it('searches name or email case-insensitively', async () => {
      await boot([
        anEmployee({ fullName: 'Ada', email: 'x1@example.com' }),
        anEmployee({ fullName: 'Bob', email: 'ADA.fan@example.com' }),
        anEmployee({ fullName: 'Carl', email: 'carl@example.com' }),
      ]);

      const res = await http().get('/employees?search=ADA').expect(200);

      expect(res.body.data.map((e: Employee) => e.fullName)).toEqual([
        'Ada',
        'Bob',
      ]);
    });

    it('filters by department, status and type', async () => {
      const match = anEmployee({
        department: FINANCE,
        status: 'INACTIVE',
        type: 'HR',
      });
      await boot([match, anEmployee(), anEmployee({ department: FINANCE })]);

      const res = await http()
        .get(`/employees?departmentId=${FINANCE.id}&status=INACTIVE&type=HR`)
        .expect(200);

      expect(res.body.data.map((e: Employee) => e.id)).toEqual([match.id]);
    });

    it('returns only deleted employees with deleted=true', async () => {
      const deleted = aDeletedEmployee();
      await boot([anEmployee(), deleted]);

      const res = await http().get('/employees?deleted=true').expect(200);

      expect(res.body.data.map((e: Employee) => e.id)).toEqual([deleted.id]);
    });

    it('excludes deleted employees by default', async () => {
      await boot([anEmployee(), aDeletedEmployee()]);

      const res = await http().get('/employees').expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it.each([
      ['pageSize=101'],
      ['pageSize=0'],
      ['page=0'],
      ['page=abc'],
      ['departmentId=abc'],
    ])('returns 400 for invalid query %s', async (query) => {
      await boot();

      const res = await http().get(`/employees?${query}`).expect(400);

      expect(res.body.type).toBe(ProblemType.validationError);
      expect(Object.keys(res.body.errors)).toHaveLength(1);
    });

    it('ignores unknown query params', async () => {
      await boot([anEmployee()]);

      await http().get('/employees?foo=bar').expect(200);
    });
  });

  describe('GET /employees/:id', () => {
    it('returns 200 with the employee', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http().get(`/employees/${employee.id}`).expect(200);

      expect(res.body).toEqual({ data: employee });
    });

    it('returns 400 for a malformed id', async () => {
      await boot();

      const res = await http().get('/employees/abc').expect(400);

      expect(res.body.type).toBe(ProblemType.validationError);
      expect(res.body.errors).toHaveProperty('id');
    });

    it('returns 404 for a well-formed unknown id', async () => {
      await boot();

      const res = await http().get(`/employees/${UNKNOWN_ID}`).expect(404);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({
        type: ProblemType.notFound,
        status: 404,
      });
    });

    it('returns 404 for a deleted employee', async () => {
      const deleted = aDeletedEmployee();
      await boot([deleted]);

      await http().get(`/employees/${deleted.id}`).expect(404);
    });
  });

  describe('PATCH /employees/:id', () => {
    it('returns 200 with the partial update applied', async () => {
      const employee = anEmployee({ jobTitle: 'Engineer' });
      await boot([employee]);

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ fullName: '  New Name ' })
        .expect(200);

      expect(res.body.data).toMatchObject({
        fullName: 'New Name',
        jobTitle: 'Engineer',
      });
    });

    it('returns 400 on _root for an empty body', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({})
        .expect(400);

      expect(res.body.errors).toEqual({ _root: ['Nothing to update'] });
    });

    it('returns 400 for an unknown field', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ deletedAt: null })
        .expect(400);

      expect(res.body.errors).toEqual({ deletedAt: ['Unknown field'] });
    });

    it('returns 400 with errors.hireDate for hireDate null', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ hireDate: null })
        .expect(400);

      expect(res.body.errors).toHaveProperty('hireDate');
    });

    it('returns 400 with errors.hireDate for a future hireDate', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ hireDate: '2030-06-01' })
        .expect(400);

      expect(res.body.errors).toHaveProperty('hireDate');
    });

    it('returns 400 for a malformed id', async () => {
      await boot();

      await http().patch('/employees/abc').send({ fullName: 'X' }).expect(400);
    });

    it('returns 404 for an unknown employee', async () => {
      await boot();

      await http()
        .patch(`/employees/${UNKNOWN_ID}`)
        .send({ fullName: 'X' })
        .expect(404);
    });

    it('returns 409 for an email used by another employee', async () => {
      const employee = anEmployee();
      await boot([employee, anEmployee({ email: 'other@example.com' })]);

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ email: 'OTHER@example.com' })
        .expect(409);

      expect(res.body.type).toBe(ProblemType.conflict);
    });

    it('returns 200 when the email is the employee own', async () => {
      const employee = anEmployee({ email: 'me@example.com' });
      await boot([employee]);

      await http()
        .patch(`/employees/${employee.id}`)
        .send({ email: 'Me@example.com' })
        .expect(200);
    });

    it('returns 400 on departmentId for an unknown department', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ departmentId: UNKNOWN_ID })
        .expect(400);

      expect(res.body.errors).toHaveProperty('departmentId');
    });

    it('returns 422 when demoting the last active HR', async () => {
      const hr = anActiveHr();
      await boot([hr]);

      const res = await http()
        .patch(`/employees/${hr.id}`)
        .send({ type: 'EMPLOYEE' })
        .expect(422);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({
        type: ProblemType.businessRuleViolation,
        status: 422,
      });
    });

    it('returns 422 when deactivating the last active HR', async () => {
      const hr = anActiveHr();
      await boot([hr]);

      await http()
        .patch(`/employees/${hr.id}`)
        .send({ status: 'INACTIVE' })
        .expect(422);
    });
  });

  describe('DELETE /employees/:id', () => {
    it('returns 204 with an empty body and hides the employee afterwards', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http().delete(`/employees/${employee.id}`).expect(204);

      expect(res.text).toBe('');
      await http().get(`/employees/${employee.id}`).expect(404);
    });

    it('returns 404 when deleting an already-deleted employee', async () => {
      const deleted = aDeletedEmployee();
      await boot([deleted]);

      await http().delete(`/employees/${deleted.id}`).expect(404);
    });

    it('returns 404 for an unknown employee', async () => {
      await boot();

      await http().delete(`/employees/${UNKNOWN_ID}`).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await boot();

      await http().delete('/employees/abc').expect(400);
    });

    it('returns 422 when deleting the last active HR', async () => {
      const hr = anActiveHr();
      await boot([hr]);

      const res = await http().delete(`/employees/${hr.id}`).expect(422);

      expect(res.body.type).toBe(ProblemType.businessRuleViolation);
    });

    it('allows deleting the first of two HRs and blocks the second', async () => {
      const [first, second] = [anActiveHr(), anActiveHr()];
      await boot([first, second]);

      await http().delete(`/employees/${first.id}`).expect(204);
      await http().delete(`/employees/${second.id}`).expect(422);
    });
  });

  describe('POST /employees/:id/restore', () => {
    it('returns 200 with the restored employee', async () => {
      const deleted = aDeletedEmployee();
      await boot([deleted]);

      const res = await http()
        .post(`/employees/${deleted.id}/restore`)
        .expect(200);

      expect(res.body.data).toMatchObject({ id: deleted.id, deletedAt: null });
      await http().get(`/employees/${deleted.id}`).expect(200);
    });

    it('returns 409 when the employee is not deleted', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http()
        .post(`/employees/${employee.id}/restore`)
        .expect(409);

      expect(res.body.type).toBe(ProblemType.conflict);
    });

    it('returns 404 for an unknown employee', async () => {
      await boot();

      await http().post(`/employees/${UNKNOWN_ID}/restore`).expect(404);
    });
  });

  describe('GET /departments', () => {
    it('returns 200 with departments ordered by name', async () => {
      await boot();

      const res = await http().get('/departments').expect(200);

      expect(res.body).toEqual({
        data: [
          { id: ENGINEERING.id, name: 'Engineering' },
          { id: FINANCE.id, name: 'Finance' },
          { id: HUMAN_RESOURCES.id, name: 'Human Resources' },
        ],
      });
    });
  });

  describe('POST /employees/:id/profile-image', () => {
    const upload = (id: string, file: Buffer, filename = 'photo.png') =>
      http()
        .post(`/employees/${id}/profile-image`)
        .attach('file', file, filename);

    it('returns 200 with the profileImageUrl for a png', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await upload(employee.id, pngOfSize(100)).expect(200);

      expect(res.body.data.profileImageUrl).toMatch(
        /^\/uploads\/employees\/.+\.png$/,
      );
      expect(storage.saved).toHaveLength(1);
    });

    it('accepts png bytes regardless of the file name', async () => {
      const employee = anEmployee();
      await boot([employee]);

      await upload(employee.id, pngOfSize(100), 'photo.jpg').expect(200);
    });

    it('replaces an existing image and removes the old file', async () => {
      const employee = anEmployee({
        profileImageUrl: '/uploads/employees/old.png',
      });
      await boot([employee]);

      await upload(employee.id, pngOfSize(100)).expect(200);

      expect(storage.removed).toEqual(['/uploads/employees/old.png']);
    });

    it('returns 415 for text content renamed to .png and stores nothing', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await upload(
        employee.id,
        Buffer.from('plain text, not an image'),
      ).expect(415);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({
        type: ProblemType.unsupportedMediaType,
        status: 415,
      });
      expect(storage.saved).toEqual([]);
    });

    it('accepts a file of exactly 2 MB', async () => {
      const employee = anEmployee();
      await boot([employee]);

      await upload(employee.id, pngOfSize(TWO_MB)).expect(200);
    });

    it('returns 413 for a file of 2 MB + 1 byte and stores nothing', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await upload(employee.id, pngOfSize(TWO_MB + 1)).expect(413);

      expect(res.body).toMatchObject({
        type: ProblemType.payloadTooLarge,
        status: 413,
      });
      expect(storage.saved).toEqual([]);
    });

    it('returns 400 on errors.file when no file is sent', async () => {
      const employee = anEmployee();
      await boot([employee]);

      const res = await http()
        .post(`/employees/${employee.id}/profile-image`)
        .field('note', 'no file here')
        .expect(400);

      expect(res.body.errors).toEqual({ file: ['File is required'] });
    });

    it('returns 404 and stores nothing for an unknown employee', async () => {
      await boot();

      await upload(UNKNOWN_ID, pngOfSize(100)).expect(404);

      expect(storage.saved).toEqual([]);
    });

    it('returns 404 and stores nothing for a deleted employee', async () => {
      const deleted = aDeletedEmployee();
      await boot([deleted]);

      await upload(deleted.id, pngOfSize(100)).expect(404);

      expect(storage.saved).toEqual([]);
    });

    it('returns 400 for a malformed id', async () => {
      await boot();

      await upload('abc', pngOfSize(100)).expect(400);
    });
  });
});
