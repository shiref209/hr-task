import { INestApplication } from '@nestjs/common';
import type { Employee } from '@hr/types';
import { createTestApp } from './create-test-app';
import { authCookie, httpAs } from './auth';
import {
  aDeletedEmployee,
  anActiveHr,
  anEmployee,
} from './fakes/employee.builder';
import {
  aUserAccount,
  InMemoryUserRepository,
} from './fakes/in-memory-user-repository';
import { USER_REPOSITORY } from '../src/auth/users.repository';
import { InMemoryEmployeeRepository } from './fakes/in-memory-employee-repository';
import { InMemorySocialInsuranceRepository } from './fakes/in-memory-social-insurance-repository';
import { InMemoryTaxTableRepository } from './fakes/in-memory-tax-table-repository';
import {
  aDefaultTaxTable,
  aSocialInsurance,
  aTaxTable,
} from './fakes/payroll.builder';

type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete';

const defaultTable = aDefaultTaxTable({ name: 'Standard' });
const overrideTable = aTaxTable({
  name: 'Exempt',
  brackets: [{ upTo: null, rate: '0.00' }],
});
const hrEmployee = anActiveHr({ fullName: 'Hana HR' });
const me = anEmployee({ fullName: 'Eli Employee', baseSalary: '7000.00' });
const colleague = anEmployee({
  fullName: 'Cole Colleague',
  baseSalary: '9000.00',
  taxTable: { id: overrideTable.id, name: overrideTable.name },
});
// Sacrificial rows: the HR pass of the matrix really deletes these.
const target = anEmployee({ fullName: 'Tara Target' });
const spareTable = aTaxTable({ name: 'Spare' });
const departed = aDeletedEmployee({ fullName: 'Dee Departed' });

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  const hrUser = aUserAccount({
    employee: { id: hrEmployee.id, type: 'HR', fullName: 'Hana HR' },
  });
  const meUser = aUserAccount({
    employee: { id: me.id, type: 'EMPLOYEE', fullName: 'Eli Employee' },
  });
  const hrUsers = {
    inactive: aUserAccount({ employee: { type: 'HR' } }),
    deleted: aUserAccount({ employee: { type: 'HR' } }),
    demoted: aUserAccount({ employee: { type: 'HR' } }),
    nonHrRoute: aUserAccount({ employee: { type: 'HR' } }),
  };
  let userRepo: InMemoryUserRepository;
  const staleHrAs = (user: (typeof hrUsers)[keyof typeof hrUsers]) =>
    httpAs(
      app,
      authCookie('HR', { userId: user.id, employeeId: user.employee.id }),
    );
  const hrCookie = () =>
    authCookie('HR', { employeeId: hrEmployee.id, userId: hrUser.id });
  const employeeCookie = () =>
    authCookie('EMPLOYEE', { employeeId: me.id, userId: meUser.id });
  const asHr = () => httpAs(app, hrCookie());
  const asEmployee = () => httpAs(app, employeeCookie());

  beforeAll(async () => {
    const employees = new InMemoryEmployeeRepository(
      [hrEmployee, me, colleague, departed, target],
      undefined,
      [defaultTable, overrideTable, spareTable].map((t) => ({
        id: t.id,
        name: t.name,
      })),
    );
    const testApp = await createTestApp({
      users: [hrUser, meUser, ...Object.values(hrUsers)],
      employees,
      taxTables: new InMemoryTaxTableRepository(
        [defaultTable, overrideTable, spareTable],
        employees,
      ),
      socialInsurance: new InMemorySocialInsuranceRepository(
        aSocialInsurance(),
      ),
    });
    app = testApp.app;
    userRepo = testApp.moduleRef.get<InMemoryUserRepository>(USER_REPOSITORY);
  });
  afterAll(async () => {
    await app.close();
  });

  // Permission matrix from specs/auth/spec.md. `hrOnly` rows return 403 for an EMPLOYEE.
  const id = target.id;
  const matrix: { verb: Verb; path: string; hrOnly: boolean }[] = [
    { verb: 'get', path: '/auth/me', hrOnly: false },
    { verb: 'get', path: '/employees', hrOnly: false },
    { verb: 'get', path: `/employees/${id}`, hrOnly: false },
    { verb: 'get', path: '/departments', hrOnly: false },
    { verb: 'post', path: '/employees', hrOnly: true },
    { verb: 'patch', path: `/employees/${id}`, hrOnly: true },
    { verb: 'delete', path: `/employees/${id}`, hrOnly: true },
    { verb: 'post', path: `/employees/${id}/restore`, hrOnly: true },
    { verb: 'post', path: `/employees/${id}/profile-image`, hrOnly: true },
    { verb: 'get', path: `/employees/${id}/pay-items`, hrOnly: true },
    { verb: 'put', path: `/employees/${id}/pay-items`, hrOnly: true },
    {
      verb: 'get',
      path: `/employees/${me.id}/payslip?month=2026-10`,
      hrOnly: false,
    },
    { verb: 'get', path: '/me/tax-table', hrOnly: false },
    { verb: 'get', path: '/tax-tables', hrOnly: true },
    { verb: 'post', path: '/tax-tables', hrOnly: true },
    { verb: 'put', path: `/tax-tables/${spareTable.id}`, hrOnly: true },
    {
      verb: 'post',
      path: `/tax-tables/${defaultTable.id}/default`,
      hrOnly: true,
    },
    { verb: 'delete', path: `/tax-tables/${spareTable.id}`, hrOnly: true },
    { verb: 'get', path: '/payroll-settings/social-insurance', hrOnly: true },
    { verb: 'put', path: '/payroll-settings/social-insurance', hrOnly: true },
  ];
  const label = ({ verb, path }: (typeof matrix)[number]) =>
    `${verb.toUpperCase()} ${path.split('?')[0]}`;

  describe('immediate revocation of HR-only routes (security review)', () => {
    it('returns 401 on GET /tax-tables for a token minted while HR after the employee became INACTIVE', async () => {
      userRepo.updateEmployee(hrUsers.inactive.id, { status: 'INACTIVE' });

      const res = await staleHrAs(hrUsers.inactive).get('/tax-tables');

      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('returns 401 on GET /tax-tables after the employee was deleted', async () => {
      userRepo.updateEmployee(hrUsers.deleted.id, {
        deletedAt: '2026-10-01T00:00:00.000Z',
      });

      await staleHrAs(hrUsers.deleted).get('/tax-tables').expect(401);
    });

    it('returns 403 on GET /tax-tables after demotion to EMPLOYEE', async () => {
      userRepo.updateEmployee(hrUsers.demoted.id, { type: 'EMPLOYEE' });

      await staleHrAs(hrUsers.demoted).get('/tax-tables').expect(403);
    });

    it('still accepts the token on non-HR routes (GET /employees) until it expires', async () => {
      userRepo.updateEmployee(hrUsers.nonHrRoute.id, { status: 'INACTIVE' });

      await staleHrAs(hrUsers.nonHrRoute).get('/employees').expect(200);
    });
  });

  describe('edge case 11: every endpoint in the matrix', () => {
    it.each(matrix.map((row) => [label(row), row] as const))(
      '%s returns 401 problem+json without a token',
      async (_name, { verb, path }) => {
        const res = await httpAs(app)[verb](path);

        expect(res.status).toBe(401);
        expect(res.headers['content-type']).toContain(
          'application/problem+json',
        );
      },
    );

    it.each(
      matrix.filter((r) => r.hrOnly).map((row) => [label(row), row] as const),
    )(
      '%s returns 403 problem+json for an EMPLOYEE',
      async (_name, { verb, path }) => {
        const res = await httpAs(app, employeeCookie())[verb](path);

        expect(res.status).toBe(403);
        expect(res.headers['content-type']).toContain(
          'application/problem+json',
        );
        expect(res.body.status).toBe(403);
      },
    );

    it.each(matrix.map((row) => [label(row), row] as const))(
      '%s is not blocked by auth for HR',
      async (_name, { verb, path }) => {
        const res = await asHr()[verb](path);

        expect([401, 403]).not.toContain(res.status);
      },
    );

    it.each(
      matrix.filter((r) => !r.hrOnly).map((row) => [label(row), row] as const),
    )(
      '%s is not blocked by role for an EMPLOYEE',
      async (_name, { verb, path }) => {
        const res = await asEmployee()[verb](path);

        expect(res.status).not.toBe(403);
      },
    );
  });

  describe('edge case 12: employees never see pay data', () => {
    it('GET /employees has no baseSalary or taxTable anywhere in the raw JSON', async () => {
      const res = await asEmployee().get('/employees').expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.text).not.toContain('baseSalary');
      expect(res.text).not.toContain('taxTable');
      expect(res.text).not.toContain('9000.00');
    });

    it('GET /employees/:id has no baseSalary or taxTable', async () => {
      const res = await asEmployee()
        .get(`/employees/${colleague.id}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: colleague.id,
        fullName: 'Cole Colleague',
      });
      expect(res.text).not.toContain('baseSalary');
      expect(res.text).not.toContain('taxTable');
    });

    it('GET /employees?deleted=true returns 403 for an EMPLOYEE', async () => {
      const res = await asEmployee().get('/employees?deleted=true').expect(403);

      expect(res.body.status).toBe(403);
    });

    it('HR still receives baseSalary and taxTable', async () => {
      const list = await asHr().get('/employees').expect(200);
      const detail = await asHr().get(`/employees/${colleague.id}`).expect(200);

      expect(list.text).toContain('baseSalary');
      expect(detail.body.data).toMatchObject({
        baseSalary: '9000.00',
        taxTable: { id: overrideTable.id },
      });
    });

    it('HR can list deleted employees', async () => {
      const res = await asHr().get('/employees?deleted=true').expect(200);

      expect(res.body.data.map((e: Employee) => e.id)).toEqual([departed.id]);
    });
  });

  describe('edge case 13: payslips', () => {
    it('lets an EMPLOYEE read their own payslip', async () => {
      const res = await asEmployee()
        .get(`/employees/${me.id}/payslip?month=2026-10`)
        .expect(200);

      expect(res.body.data.employee.id).toBe(me.id);
    });

    it("returns 403 for another employee's payslip", async () => {
      const res = await asEmployee()
        .get(`/employees/${colleague.id}/payslip?month=2026-10`)
        .expect(403);

      expect(res.body.status).toBe(403);
    });

    it('still applies the payslip rules to their own: 422 before the hire date', async () => {
      await asEmployee()
        .get(`/employees/${me.id}/payslip?month=2020-01`)
        .expect(422);
    });

    it('lets HR read any payslip', async () => {
      await asHr()
        .get(`/employees/${colleague.id}/payslip?month=2026-10`)
        .expect(200);
    });
  });

  describe('edge case 14: GET /me/tax-table', () => {
    it('returns the default table, without employeeCount, for an employee with no override', async () => {
      const res = await asEmployee().get('/me/tax-table').expect(200);

      expect(res.body.data).toMatchObject({
        id: defaultTable.id,
        name: 'Standard',
      });
      expect(res.body.data).not.toHaveProperty('employeeCount');
    });

    it('returns the override table when the employee has one', async () => {
      const cookie = authCookie('EMPLOYEE', { employeeId: colleague.id });

      const res = await httpAs(app, cookie).get('/me/tax-table').expect(200);

      expect(res.body.data).toMatchObject({
        id: overrideTable.id,
        name: 'Exempt',
        brackets: [{ upTo: null, rate: '0.00' }],
      });
      expect(res.body.data).not.toHaveProperty('employeeCount');
    });
  });
});
