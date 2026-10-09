import { describe, expect, it } from 'vitest';
import {
  buildCreateEmployeeSchema,
  buildUpdateEmployeeSchema,
  employeeListQuerySchema,
} from './employee.schema';

const TODAY = '2026-10-08';
const DEPARTMENT_ID = '3f2b8c1e-5d4a-4b7e-9c1a-2d3e4f5a6b7c';

const createSchema = buildCreateEmployeeSchema({ today: TODAY });
const updateSchema = buildUpdateEmployeeSchema({ today: TODAY });

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    jobTitle: 'Engineer',
    departmentId: DEPARTMENT_ID,
    hireDate: '2024-01-15',
    baseSalary: '5000.00',
    ...overrides,
  };
}

function emailOfLength(length: number): string {
  return `${'a'.repeat(length - '@x.com'.length)}@x.com`;
}

function issuePaths(
  schema: typeof createSchema | typeof updateSchema,
  input: unknown,
) {
  const result = schema.safeParse(input);
  if (result.success) return null;
  return result.error.issues.map((issue) => issue.path.join('.'));
}

function createFails(
  overrides: Record<string, unknown>,
  field: string,
): boolean {
  return (
    issuePaths(createSchema, validInput(overrides))?.includes(field) ?? false
  );
}

function createOk(overrides: Record<string, unknown>): boolean {
  return createSchema.safeParse(validInput(overrides)).success;
}

describe('buildCreateEmployeeSchema', () => {
  it('accepts a minimal valid input and applies status/type defaults', () => {
    const parsed = createSchema.parse(validInput());

    expect(parsed.status).toBe('ACTIVE');
    expect(parsed.type).toBe('EMPLOYEE');
  });

  it('keeps explicit status and type', () => {
    const parsed = createSchema.parse(
      validInput({ status: 'INACTIVE', type: 'HR' }),
    );

    expect(parsed).toMatchObject({ status: 'INACTIVE', type: 'HR' });
  });

  it('rejects an invalid status', () => {
    expect(createFails({ status: 'FIRED' }, 'status')).toBe(true);
  });

  it('rejects an invalid type', () => {
    expect(createFails({ type: 'ADMIN' }, 'type')).toBe(true);
  });

  it('reports every missing required field at once', () => {
    const paths = issuePaths(createSchema, {}) ?? [];

    expect([...paths].sort()).toEqual(
      [
        'baseSalary',
        'departmentId',
        'email',
        'fullName',
        'hireDate',
        'jobTitle',
      ].sort(),
    );
  });

  describe('unknown keys', () => {
    it('rejects an unknown key (strict)', () => {
      const result = createSchema.safeParse(validInput({ deletedAt: null }));

      expect(result.success).toBe(false);
    });

    it('reports the unknown key as an unrecognized_keys issue', () => {
      const result = createSchema.safeParse(validInput({ foo: 1 }));

      expect(
        result.success ? [] : result.error.issues.map((i) => i.code),
      ).toContain('unrecognized_keys');
    });
  });

  describe.each([['fullName'], ['jobTitle']])('%s', (field) => {
    it('trims surrounding whitespace', () => {
      expect(
        createSchema.parse(validInput({ [field]: '  Ada  ' })),
      ).toMatchObject({
        [field]: 'Ada',
      });
    });

    it('rejects an empty string', () => {
      expect(createFails({ [field]: '' }, field)).toBe(true);
    });

    it('rejects whitespace only', () => {
      expect(createFails({ [field]: '   ' }, field)).toBe(true);
    });

    it('accepts exactly 100 characters', () => {
      expect(createOk({ [field]: 'a'.repeat(100) })).toBe(true);
    });

    it('rejects 101 characters', () => {
      expect(createFails({ [field]: 'a'.repeat(101) }, field)).toBe(true);
    });

    it('accepts 100 characters once padding whitespace is trimmed', () => {
      expect(createOk({ [field]: ` ${'a'.repeat(100)} ` })).toBe(true);
    });
  });

  describe('email', () => {
    it('trims and lowercases', () => {
      expect(
        createSchema.parse(validInput({ email: '  Ada@Example.COM ' })).email,
      ).toBe('ada@example.com');
    });

    it.each(['nope', 'a@', '@x.com', 'a b@x.com', ''])(
      'rejects invalid email %j',
      (email) => {
        expect(createFails({ email }, 'email')).toBe(true);
      },
    );

    it('accepts exactly 254 characters', () => {
      expect(createOk({ email: emailOfLength(254) })).toBe(true);
    });

    it('rejects 255 characters', () => {
      expect(createFails({ email: emailOfLength(255) }, 'email')).toBe(true);
    });
  });

  describe('phone', () => {
    const phoneOf = (phone: unknown) =>
      createSchema.parse(validInput({ phone })).phone;

    it('accepts an omitted phone', () => {
      expect(createSchema.safeParse(validInput()).success).toBe(true);
    });

    it('strips spaces', () => {
      expect(phoneOf('+20 100 123 4567')).toBe('+201001234567');
    });

    it('strips dashes and parentheses', () => {
      expect(phoneOf('+1 (555) 123-4567')).toBe('+15551234567');
    });

    it('turns an empty string into null', () => {
      expect(phoneOf('')).toBeNull();
    });

    it('accepts null', () => {
      expect(phoneOf(null)).toBeNull();
    });

    it('rejects a number without a leading +', () => {
      expect(createFails({ phone: '01001234567' }, 'phone')).toBe(true);
    });

    it('rejects a country code starting with 0', () => {
      expect(createFails({ phone: '+0123456789' }, 'phone')).toBe(true);
    });

    it('accepts 8 digits', () => {
      expect(phoneOf('+12345678')).toBe('+12345678');
    });

    it('accepts 15 digits', () => {
      expect(phoneOf('+123456789012345')).toBe('+123456789012345');
    });

    it('rejects 7 digits', () => {
      expect(createFails({ phone: '+1234567' }, 'phone')).toBe(true);
    });

    it('rejects 16 digits', () => {
      expect(createFails({ phone: '+1234567890123456' }, 'phone')).toBe(true);
    });

    it('rejects letters', () => {
      expect(createFails({ phone: '+12345abc90' }, 'phone')).toBe(true);
    });
  });

  describe('hireDate', () => {
    it('accepts today', () => {
      expect(createOk({ hireDate: TODAY })).toBe(true);
    });

    it('accepts yesterday', () => {
      expect(createOk({ hireDate: '2026-10-07' })).toBe(true);
    });

    it('rejects tomorrow', () => {
      expect(createFails({ hireDate: '2026-10-09' }, 'hireDate')).toBe(true);
    });

    it('uses the injected today, not the system clock', () => {
      const earlier = buildCreateEmployeeSchema({ today: '2020-01-01' });

      expect(
        earlier.safeParse(validInput({ hireDate: '2020-01-02' })).success,
      ).toBe(false);
      expect(
        earlier.safeParse(validInput({ hireDate: '2020-01-01' })).success,
      ).toBe(true);
    });

    it('accepts a leap day in a leap year', () => {
      expect(createOk({ hireDate: '2024-02-29' })).toBe(true);
    });

    it('rejects Feb 29 in a non-leap year', () => {
      expect(createFails({ hireDate: '2026-02-29' }, 'hireDate')).toBe(true);
    });

    it('rejects Feb 30', () => {
      expect(createFails({ hireDate: '2026-02-30' }, 'hireDate')).toBe(true);
    });

    it.each(['08/10/2026', '2026-1-5', '2026-10-08T00:00:00Z', '20261008', ''])(
      'rejects the wrong format %j',
      (hireDate) => {
        expect(createFails({ hireDate }, 'hireDate')).toBe(true);
      },
    );

    it('rejects a non-string', () => {
      expect(createFails({ hireDate: 20261008 }, 'hireDate')).toBe(true);
    });
  });

  describe('baseSalary', () => {
    it.each(['0', '0.00', '-1', '-0.01'])(
      'rejects %j (must be > 0)',
      (baseSalary) => {
        expect(createFails({ baseSalary }, 'baseSalary')).toBe(true);
      },
    );

    it.each(['0.01', '1', '5000', '5000.5', '5000.50'])(
      'accepts %j',
      (baseSalary) => {
        expect(createOk({ baseSalary })).toBe(true);
      },
    );

    it('rejects more than 2 decimal places instead of rounding', () => {
      expect(createFails({ baseSalary: '10.005' }, 'baseSalary')).toBe(true);
    });

    it('rejects a JSON number', () => {
      expect(createFails({ baseSalary: 5000 }, 'baseSalary')).toBe(true);
    });

    it('accepts the maximum 9999999999.99', () => {
      expect(createOk({ baseSalary: '9999999999.99' })).toBe(true);
    });

    it('rejects 10000000000.00', () => {
      expect(createFails({ baseSalary: '10000000000.00' }, 'baseSalary')).toBe(
        true,
      );
    });

    it.each(['abc', '', '1e3', '1,000.00', ' '])(
      'rejects non-decimal text %j',
      (baseSalary) => {
        expect(createFails({ baseSalary }, 'baseSalary')).toBe(true);
      },
    );
  });

  describe('departmentId', () => {
    it('rejects a non-uuid', () => {
      expect(createFails({ departmentId: 'engineering' }, 'departmentId')).toBe(
        true,
      );
    });
  });
});

describe('buildUpdateEmployeeSchema', () => {
  it('accepts a single field', () => {
    expect(updateSchema.parse({ jobTitle: 'Lead' })).toEqual({
      jobTitle: 'Lead',
    });
  });

  it('does not apply status/type defaults', () => {
    expect(updateSchema.parse({ jobTitle: 'Lead' })).not.toHaveProperty(
      'status',
    );
  });

  it('reports an empty object as a root-level "Nothing to update" issue', () => {
    const result = updateSchema.safeParse({});

    expect(result.success ? [] : result.error.issues).toEqual([
      expect.objectContaining({ path: [], message: 'Nothing to update' }),
    ]);
  });

  it('allows phone null to clear the phone', () => {
    expect(updateSchema.parse({ phone: null })).toEqual({ phone: null });
  });

  it('normalizes phone like create', () => {
    expect(updateSchema.parse({ phone: '+20 100 123 4567' }).phone).toBe(
      '+201001234567',
    );
  });

  it('rejects an unknown key', () => {
    expect(updateSchema.safeParse({ fullName: 'Ada', foo: 1 }).success).toBe(
      false,
    );
  });

  it('rejects deletedAt (never accepted from clients)', () => {
    expect(updateSchema.safeParse({ deletedAt: null }).success).toBe(false);
  });

  it('applies the same per-field rules: trimmed name', () => {
    expect(updateSchema.parse({ fullName: '  Ada  ' }).fullName).toBe('Ada');
  });

  it('rejects whitespace-only fullName', () => {
    expect(issuePaths(updateSchema, { fullName: '  ' })).toContain('fullName');
  });

  it('lowercases email', () => {
    expect(updateSchema.parse({ email: 'ADA@Example.com' }).email).toBe(
      'ada@example.com',
    );
  });

  it('rejects baseSalary "0"', () => {
    expect(issuePaths(updateSchema, { baseSalary: '0' })).toContain(
      'baseSalary',
    );
  });

  it('rejects hireDate tomorrow and accepts today', () => {
    expect(issuePaths(updateSchema, { hireDate: '2026-10-09' })).toContain(
      'hireDate',
    );
    expect(updateSchema.safeParse({ hireDate: TODAY }).success).toBe(true);
  });

  it('rejects status outside the enum', () => {
    expect(issuePaths(updateSchema, { status: 'X' })).toContain('status');
  });

  it('rejects a non-uuid departmentId', () => {
    expect(issuePaths(updateSchema, { departmentId: '1' })).toContain(
      'departmentId',
    );
  });
});

describe('employeeListQuerySchema', () => {
  it('applies defaults for an empty query', () => {
    expect(employeeListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      deleted: false,
    });
  });

  it('coerces page and pageSize from strings', () => {
    expect(
      employeeListQuerySchema.parse({ page: '2', pageSize: '5' }),
    ).toMatchObject({
      page: 2,
      pageSize: 5,
    });
  });

  it.each([
    { page: '0' },
    { pageSize: '0' },
    { pageSize: '101' },
    { page: 'abc' },
  ])('rejects invalid pagination %j', (query) => {
    expect(employeeListQuerySchema.safeParse(query).success).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('maps deleted=%s to boolean %s', (raw, expected) => {
    expect(employeeListQuerySchema.parse({ deleted: raw }).deleted).toBe(
      expected,
    );
  });

  it('rejects other deleted values', () => {
    expect(employeeListQuerySchema.safeParse({ deleted: 'yes' }).success).toBe(
      false,
    );
  });

  it('trims search', () => {
    expect(employeeListQuerySchema.parse({ search: '  ada ' }).search).toBe(
      'ada',
    );
  });

  it('turns an empty search into undefined', () => {
    expect(
      employeeListQuerySchema.parse({ search: '' }).search,
    ).toBeUndefined();
  });

  it('turns a whitespace-only search into undefined', () => {
    expect(
      employeeListQuerySchema.parse({ search: '   ' }).search,
    ).toBeUndefined();
  });

  it('accepts a 100-character search and rejects 101', () => {
    expect(
      employeeListQuerySchema.safeParse({ search: 'a'.repeat(100) }).success,
    ).toBe(true);
    expect(
      employeeListQuerySchema.safeParse({ search: 'a'.repeat(101) }).success,
    ).toBe(false);
  });

  it('accepts a uuid departmentId', () => {
    expect(
      employeeListQuerySchema.parse({ departmentId: DEPARTMENT_ID })
        .departmentId,
    ).toBe(DEPARTMENT_ID);
  });

  it('rejects a non-uuid departmentId', () => {
    expect(
      employeeListQuerySchema.safeParse({ departmentId: 'abc' }).success,
    ).toBe(false);
  });

  it('accepts valid status and type filters', () => {
    expect(
      employeeListQuerySchema.parse({ status: 'INACTIVE', type: 'HR' }),
    ).toMatchObject({
      status: 'INACTIVE',
      type: 'HR',
    });
  });

  it('rejects invalid status and type filters', () => {
    expect(employeeListQuerySchema.safeParse({ status: 'X' }).success).toBe(
      false,
    );
    expect(employeeListQuerySchema.safeParse({ type: 'X' }).success).toBe(
      false,
    );
  });

  it('strips unknown params instead of rejecting them', () => {
    const parsed = employeeListQuerySchema.parse({ foo: 'bar' });

    expect(parsed).not.toHaveProperty('foo');
  });
});
