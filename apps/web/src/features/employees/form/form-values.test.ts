import { describe, expect, it } from 'vitest';
import { anEmployee, DEPARTMENT_IDS } from '../test-utils';
import {
  changedFields,
  emptyFormValues,
  toCreateInput,
  toFormValues,
  type EmployeeFormValues,
} from './form-values';

const values = (overrides: Partial<EmployeeFormValues> = {}): EmployeeFormValues => ({
  fullName: 'Ahmed Zaki',
  email: 'ahmed@example.com',
  baseSalary: '12500.00',
  jobTitle: 'Ops Lead',
  departmentId: DEPARTMENT_IDS.operations,
  hireDate: '2024-01-15',
  phone: '',
  status: 'ACTIVE',
  type: 'EMPLOYEE',
  ...overrides,
});

describe('toFormValues', () => {
  it('maps an employee to string form values with phone null as empty string', () => {
    const employee = anEmployee(1, { fullName: 'Ahmed Zaki', phone: null, baseSalary: '12500.00' });
    expect(toFormValues(employee)).toEqual(
      values({ email: 'employee1@example.com' }),
    );
  });

  it('keeps an existing phone', () => {
    expect(toFormValues(anEmployee(1, { phone: '+201001234567' })).phone).toBe('+201001234567');
  });

  it('flattens the department to its id', () => {
    expect(toFormValues(anEmployee(1)).departmentId).toBe(DEPARTMENT_IDS.operations);
  });
});

describe('emptyFormValues', () => {
  it('defaults to Active / Employee with every other field empty', () => {
    expect(emptyFormValues).toEqual({
      fullName: '',
      email: '',
      baseSalary: '',
      jobTitle: '',
      departmentId: '',
      hireDate: '',
      phone: '',
      status: 'ACTIVE',
      type: 'EMPLOYEE',
    });
  });
});

describe('toCreateInput', () => {
  it('sends an empty phone as null', () => {
    expect(toCreateInput(values({ phone: '' })).phone).toBeNull();
  });

  it('keeps a typed phone', () => {
    expect(toCreateInput(values({ phone: '+201001234567' })).phone).toBe('+201001234567');
  });

  it('normalizes the salary to a 2-decimal string', () => {
    expect(toCreateInput(values({ baseSalary: '12,500.5' })).baseSalary).toBe('12500.50');
  });

  it('passes the other fields through', () => {
    expect(toCreateInput(values())).toEqual({
      fullName: 'Ahmed Zaki',
      email: 'ahmed@example.com',
      baseSalary: '12500.00',
      jobTitle: 'Ops Lead',
      departmentId: DEPARTMENT_IDS.operations,
      hireDate: '2024-01-15',
      phone: null,
      status: 'ACTIVE',
      type: 'EMPLOYEE',
    });
  });
});

describe('changedFields', () => {
  it('returns only the keys that changed', () => {
    expect(changedFields(values(), values({ jobTitle: 'Ops Manager', status: 'INACTIVE' }))).toEqual({
      jobTitle: 'Ops Manager',
      status: 'INACTIVE',
    });
  });

  it('returns null for a cleared phone', () => {
    expect(changedFields(values({ phone: '+201001234567' }), values({ phone: '' }))).toEqual({
      phone: null,
    });
  });

  it('returns a normalized salary when the salary changed', () => {
    expect(changedFields(values(), values({ baseSalary: '13,000.5' }))).toEqual({
      baseSalary: '13000.50',
    });
  });

  it('returns an empty object when nothing changed', () => {
    expect(changedFields(values(), values())).toEqual({});
  });
});
