import { INestApplication } from '@nestjs/common';
import { ProblemType } from '@hr/types';
import type { Employee, PayItems, TaxTable } from '@hr/types';
import { aDeletedEmployee, anEmployee } from './fakes/employee.builder';
import { createTestApp } from './create-test-app';
import { authCookie, httpAs } from './auth';
import { InMemoryEmployeeRepository } from './fakes/in-memory-employee-repository';
import { InMemoryPayItemRepository } from './fakes/in-memory-pay-item-repository';
import { InMemorySocialInsuranceRepository } from './fakes/in-memory-social-insurance-repository';
import { InMemoryTaxTableRepository } from './fakes/in-memory-tax-table-repository';
import {
  aDefaultTaxTable,
  aSocialInsurance,
  aTaxTable,
  somePayItems,
} from './fakes/payroll.builder';

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';

describe('Payroll (e2e)', () => {
  let app: INestApplication;
  const http = () => httpAs(app, authCookie('HR'));

  async function boot(
    options: {
      employees?: Employee[];
      tables?: TaxTable[];
      insuranceRate?: string;
      payItems?: Record<string, PayItems>;
    } = {},
  ) {
    const tables = options.tables ?? [aDefaultTaxTable({ name: 'Standard' })];
    const employees = new InMemoryEmployeeRepository(
      options.employees ?? [],
      undefined,
      tables.map((t) => ({ id: t.id, name: t.name })),
    );
    ({ app } = await createTestApp({
      employees,
      taxTables: new InMemoryTaxTableRepository(tables, employees),
      socialInsurance: new InMemorySocialInsuranceRepository(
        aSocialInsurance({ rate: options.insuranceRate ?? '11.00' }),
      ),
      payItems: new InMemoryPayItemRepository(options.payItems),
    }));
  }

  afterEach(async () => {
    await app.close();
  });

  describe('GET /tax-tables', () => {
    it('returns 200 with brackets, the default first', async () => {
      const standard = aDefaultTaxTable({ name: 'Zeta' });
      const other = aTaxTable({ name: 'Alpha' });
      await boot({ tables: [other, standard] });

      const res = await http().get('/tax-tables').expect(200);

      expect(res.body.data.map((t: TaxTable) => t.name)).toEqual([
        'Zeta',
        'Alpha',
      ]);
      expect(res.body.data[0]).toMatchObject({
        id: standard.id,
        isDefault: true,
        brackets: [
          { upTo: '10000.00', rate: '0.00' },
          { upTo: '20000.00', rate: '10.00' },
          { upTo: null, rate: '15.00' },
        ],
      });
    });
  });

  describe('POST /tax-tables', () => {
    const body = (overrides: Record<string, unknown> = {}) => ({
      name: 'Exempt',
      brackets: [{ upTo: null, rate: '0' }],
      ...overrides,
    });

    it('returns 201 with the created, non-default table', async () => {
      await boot();

      const res = await http().post('/tax-tables').send(body()).expect(201);

      expect(res.body.data).toMatchObject({ name: 'Exempt', isDefault: false });
      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('returns 400 with the failing bracket path', async () => {
      await boot();

      const res = await http()
        .post('/tax-tables')
        .send(
          body({
            brackets: [
              { upTo: '20000', rate: '10' },
              { upTo: '10000', rate: '15' },
            ],
          }),
        )
        .expect(400);

      expect(res.body).toMatchObject({
        type: ProblemType.validationError,
        status: 400,
        instance: '/tax-tables',
      });
      expect(Object.keys(res.body.errors)).toContain('brackets.1.upTo');
    });

    it('returns 409 for a name used by another table, ignoring case', async () => {
      await boot();

      const res = await http()
        .post('/tax-tables')
        .send(body({ name: 'standard' }))
        .expect(409);

      expect(res.body).toMatchObject({ status: 409 });
    });

    it('returns 422 when highest bracket rate + insurance rate exceeds 100', async () => {
      await boot({ insuranceRate: '11.00' });

      const res = await http()
        .post('/tax-tables')
        .send(body({ brackets: [{ upTo: null, rate: '89.01' }] }))
        .expect(422);

      expect(res.body).toMatchObject({ status: 422 });
    });
  });

  describe('PUT /tax-tables/:id', () => {
    it('returns 200 with the replaced name and brackets', async () => {
      const table = aTaxTable({ name: 'Old' });
      await boot({ tables: [aDefaultTaxTable(), table] });

      const res = await http()
        .put(`/tax-tables/${table.id}`)
        .send({ name: 'New', brackets: [{ upTo: null, rate: '5' }] })
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: table.id,
        name: 'New',
        brackets: [{ upTo: null, rate: '5.00' }],
      });
    });

    it('returns 404 for an unknown table', async () => {
      await boot();

      await http()
        .put(`/tax-tables/${UNKNOWN_ID}`)
        .send({ name: 'New', brackets: [{ upTo: null, rate: '5' }] })
        .expect(404);
    });
  });

  describe('POST /tax-tables/:id/default', () => {
    it('returns 200 and switches the default', async () => {
      const next = aTaxTable({ name: 'Next' });
      await boot({ tables: [aDefaultTaxTable(), next] });

      const res = await http()
        .post(`/tax-tables/${next.id}/default`)
        .expect(200);
      const list = await http().get('/tax-tables').expect(200);

      expect(res.body.data).toMatchObject({ id: next.id, isDefault: true });
      expect(list.body.data.filter((t: TaxTable) => t.isDefault)).toHaveLength(
        1,
      );
      expect(list.body.data[0].id).toBe(next.id);
    });

    it('returns 404 for an unknown table', async () => {
      await boot();

      await http().post(`/tax-tables/${UNKNOWN_ID}/default`).expect(404);
    });
  });

  describe('DELETE /tax-tables/:id', () => {
    it('returns 204 for an unassigned non-default table', async () => {
      const table = aTaxTable({ name: 'Unused' });
      await boot({ tables: [aDefaultTaxTable(), table] });

      await http().delete(`/tax-tables/${table.id}`).expect(204);
    });

    it('returns 409 for the default table', async () => {
      const current = aDefaultTaxTable();
      await boot({ tables: [current] });

      const res = await http().delete(`/tax-tables/${current.id}`).expect(409);

      expect(res.body.detail).toMatch(/choose another default first/i);
    });

    it('returns 409 naming the employee count for an assigned table', async () => {
      const table = aTaxTable({ name: 'Used' });
      await boot({
        tables: [aDefaultTaxTable(), table],
        employees: [1, 2].map(() =>
          anEmployee({ taxTable: { id: table.id, name: table.name } }),
        ),
      });

      const res = await http().delete(`/tax-tables/${table.id}`).expect(409);

      expect(res.body.detail).toMatch(/Used by 2 employees/);
    });

    it('returns 204 for a table held only by a deleted employee, which then uses the default', async () => {
      const table = aTaxTable({ name: 'Old' });
      const gone = aDeletedEmployee({
        taxTable: { id: table.id, name: table.name },
      });
      await boot({ tables: [aDefaultTaxTable(), table], employees: [gone] });

      await http().delete(`/tax-tables/${table.id}`).expect(204);
      const list = await http().get('/tax-tables').expect(200);

      expect(list.body.data.map((t: TaxTable) => t.id)).not.toContain(table.id);
    });

    it('returns 404 for an unknown table', async () => {
      await boot();

      await http().delete(`/tax-tables/${UNKNOWN_ID}`).expect(404);
    });
  });

  describe('/payroll-settings/social-insurance', () => {
    it('GET returns 200 with rate and cap', async () => {
      await boot();

      const res = await http()
        .get('/payroll-settings/social-insurance')
        .expect(200);

      expect(res.body.data).toEqual({ rate: '11.00', cap: '2000.00' });
    });

    it('PUT returns 200 with the saved settings', async () => {
      await boot();

      const res = await http()
        .put('/payroll-settings/social-insurance')
        .send({ rate: '14', cap: null })
        .expect(200);

      expect(res.body.data).toEqual({ rate: '14.00', cap: null });
    });

    it('PUT returns 400 for an invalid rate', async () => {
      await boot();

      const res = await http()
        .put('/payroll-settings/social-insurance')
        .send({ rate: '101', cap: null })
        .expect(400);

      expect(Object.keys(res.body.errors)).toContain('rate');
    });

    it('PUT returns 422 when the rate plus the highest bracket rate exceeds 100', async () => {
      await boot();

      await http()
        .put('/payroll-settings/social-insurance')
        .send({ rate: '85.01', cap: null })
        .expect(422);
    });
  });

  describe('/employees/:id/pay-items', () => {
    it('GET returns 200 with allowances and deductions', async () => {
      const employee = anEmployee();
      const items = somePayItems({
        allowances: [{ name: 'Transport', amount: '500.00' }],
        deductions: [{ name: 'Loan', amount: '100.00' }],
      });
      await boot({ employees: [employee], payItems: { [employee.id]: items } });

      const res = await http()
        .get(`/employees/${employee.id}/pay-items`)
        .expect(200);

      expect(res.body.data).toEqual(items);
    });

    it('PUT returns 200 and replaces both lists keeping order', async () => {
      const employee = anEmployee();
      await boot({ employees: [employee] });
      const items = {
        allowances: [
          { name: 'B', amount: '2.00' },
          { name: 'A', amount: '1.00' },
        ],
        deductions: [{ name: 'Loan', amount: '5.00' }],
      };

      const put = await http()
        .put(`/employees/${employee.id}/pay-items`)
        .send(items)
        .expect(200);
      const get = await http()
        .get(`/employees/${employee.id}/pay-items`)
        .expect(200);

      expect(put.body.data).toEqual(items);
      expect(get.body.data).toEqual(items);
    });

    it('PUT returns 400 with the failing item path', async () => {
      const employee = anEmployee();
      await boot({ employees: [employee] });

      const res = await http()
        .put(`/employees/${employee.id}/pay-items`)
        .send({ allowances: [{ name: 'Bonus', amount: '0' }], deductions: [] })
        .expect(400);

      expect(Object.keys(res.body.errors)).toContain('allowances.0.amount');
    });

    it('GET and PUT return 404 for an unknown employee', async () => {
      await boot();

      await http().get(`/employees/${UNKNOWN_ID}/pay-items`).expect(404);
      await http()
        .put(`/employees/${UNKNOWN_ID}/pay-items`)
        .send({ allowances: [], deductions: [] })
        .expect(404);
    });
  });

  describe('PATCH /employees/:id with taxTableId', () => {
    it('assigns a tax table and returns it embedded, then clears it with null', async () => {
      const table = aTaxTable({ name: 'Exempt' });
      const employee = anEmployee();
      await boot({
        employees: [employee],
        tables: [aDefaultTaxTable(), table],
      });

      const assigned = await http()
        .patch(`/employees/${employee.id}`)
        .send({ taxTableId: table.id })
        .expect(200);
      const cleared = await http()
        .patch(`/employees/${employee.id}`)
        .send({ taxTableId: null })
        .expect(200);

      expect(assigned.body.data.taxTable).toEqual({
        id: table.id,
        name: 'Exempt',
      });
      expect(cleared.body.data.taxTable).toBeNull();
    });

    it('returns 400 with "Select a tax table" for an unknown taxTableId', async () => {
      const employee = anEmployee();
      await boot({ employees: [employee] });

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ taxTableId: UNKNOWN_ID })
        .expect(400);

      expect(res.body.errors.taxTableId).toEqual(['Select a tax table']);
    });

    it('returns 400 for a taxTableId that is not a uuid', async () => {
      const employee = anEmployee();
      await boot({ employees: [employee] });

      const res = await http()
        .patch(`/employees/${employee.id}`)
        .send({ taxTableId: 'standard' })
        .expect(400);

      expect(Object.keys(res.body.errors)).toContain('taxTableId');
    });
  });

  describe('GET /employees/:id/payslip', () => {
    it('returns 200 with the full payslip for the 25,000 worked example', async () => {
      const standard = aDefaultTaxTable({ name: 'Standard' });
      const employee = anEmployee({
        fullName: 'Ada Lovelace',
        baseSalary: '25000.00',
      });
      await boot({
        employees: [employee],
        tables: [standard],
        payItems: {
          [employee.id]: somePayItems({
            allowances: [{ name: 'Allowances', amount: '1500.00' }],
            deductions: [{ name: 'Loan', amount: '500.00' }],
          }),
        },
      });

      const res = await http()
        .get(`/employees/${employee.id}/payslip?month=2026-10`)
        .expect(200);

      expect(res.body.data).toEqual({
        employee: { id: employee.id, fullName: 'Ada Lovelace' },
        month: '2026-10',
        taxTable: { id: standard.id, name: 'Standard' },
        baseSalary: '25000.00',
        allowances: [{ name: 'Allowances', amount: '1500.00' }],
        allowancesTotal: '1500.00',
        gross: '26500.00',
        tax: {
          total: '1750.00',
          effectiveRate: '7.00',
          brackets: [
            {
              from: '0.00',
              upTo: '10000.00',
              rate: '0.00',
              taxable: '10000.00',
              tax: '0.00',
            },
            {
              from: '10000.00',
              upTo: '20000.00',
              rate: '10.00',
              taxable: '10000.00',
              tax: '1000.00',
            },
            {
              from: '20000.00',
              upTo: null,
              rate: '15.00',
              taxable: '5000.00',
              tax: '750.00',
            },
          ],
        },
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
    });

    it.each(['', '?month=2026-13', '?month=2026-3'])(
      'returns 400 for month query %j',
      async (query) => {
        const employee = anEmployee();
        await boot({ employees: [employee] });

        const res = await http()
          .get(`/employees/${employee.id}/payslip${query}`)
          .expect(400);

        expect(Object.keys(res.body.errors)).toContain('month');
      },
    );

    it('returns 422 naming the month when it is before the hire month', async () => {
      const employee = anEmployee({ hireDate: '2026-03-15' });
      await boot({ employees: [employee] });

      const res = await http()
        .get(`/employees/${employee.id}/payslip?month=2026-02`)
        .expect(422);

      expect(res.body.detail).toMatch(
        /Not yet hired in 2026-02 \(hire date 2026-03-15\)/,
      );
    });

    it('returns 422 for an inactive employee', async () => {
      const employee = anEmployee({ status: 'INACTIVE' });
      await boot({ employees: [employee] });

      await http()
        .get(`/employees/${employee.id}/payslip?month=2026-10`)
        .expect(422);
    });

    it('returns 404 for an unknown employee', async () => {
      await boot();

      await http()
        .get(`/employees/${UNKNOWN_ID}/payslip?month=2026-10`)
        .expect(404);
    });
  });
});
