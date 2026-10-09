import { describe, expect, it } from 'vitest';
import { employeeSchema, employeeSummarySchema } from './employee.schema';

const employee = {
  id: '3f2b8c1e-5d4a-4b7e-9c1a-2d3e4f5a6b7c',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: null,
  jobTitle: 'Engineer',
  department: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Engineering',
  },
  hireDate: '2024-01-15',
  baseSalary: '5000.00',
  status: 'ACTIVE',
  type: 'EMPLOYEE',
  profileImageUrl: null,
  taxTable: { id: '22222222-2222-4222-8222-222222222222', name: 'Standard' },
  deletedAt: null,
  createdAt: '2024-01-15T09:00:00.000Z',
  updatedAt: '2024-01-15T09:00:00.000Z',
};

describe('employeeSummarySchema', () => {
  it('has no baseSalary or taxTable key', () => {
    const keys = Object.keys(employeeSummarySchema.shape);

    expect(keys).not.toContain('baseSalary');
    expect(keys).not.toContain('taxTable');
  });

  it('has every other employee key', () => {
    const expected = Object.keys(employeeSchema.shape).filter(
      (key) => key !== 'baseSalary' && key !== 'taxTable',
    );

    expect(Object.keys(employeeSummarySchema.shape).sort()).toEqual(
      expected.sort(),
    );
  });

  it('strips pay fields when parsing a full employee', () => {
    const summary = employeeSummarySchema.parse(employee);

    expect(summary).not.toHaveProperty('baseSalary');
    expect(summary).not.toHaveProperty('taxTable');
    expect(summary.fullName).toBe('Ada Lovelace');
  });
});
