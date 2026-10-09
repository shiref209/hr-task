import { describe, expect, it } from 'vitest';
import { taxBracketInputSchema, taxTableInputSchema } from './tax-table.schema';

type BracketInput = { upTo: string | null; rate: string };

const standard: BracketInput[] = [
  { upTo: '10000.00', rate: '0' },
  { upTo: '20000.00', rate: '10' },
  { upTo: null, rate: '15' },
];

function table(brackets: unknown, name: unknown = 'Standard') {
  return { name, brackets };
}

function paths(input: unknown): string[] | null {
  const result = taxTableInputSchema.safeParse(input);
  if (result.success) return null;
  return result.error.issues.map((issue) => issue.path.join('.'));
}

describe('taxTableInputSchema', () => {
  it('accepts the standard three-bracket table', () => {
    expect(taxTableInputSchema.safeParse(table(standard)).success).toBe(true);
  });

  it('accepts a single open bracket (flat tax, edge case 4)', () => {
    const flat = table([{ upTo: null, rate: '0' }]);

    expect(taxTableInputSchema.safeParse(flat).success).toBe(true);
  });

  it('rejects a table without brackets', () => {
    expect(paths(table([]))).toContain('brackets');
  });

  it('rejects upper limits that do not strictly increase, at the offending bracket', () => {
    const equal = table([
      { upTo: '10000', rate: '0' },
      { upTo: '10000', rate: '10' },
      { upTo: null, rate: '15' },
    ]);
    const decreasing = table([
      { upTo: '10000', rate: '0' },
      { upTo: '5000', rate: '10' },
      { upTo: null, rate: '15' },
    ]);

    expect(paths(equal)).toEqual(['brackets.1.upTo']);
    expect(paths(decreasing)).toEqual(['brackets.1.upTo']);
  });

  it('rejects a zero or negative upper limit', () => {
    expect(
      paths(
        table([
          { upTo: '0', rate: '1' },
          { upTo: null, rate: '2' },
        ]),
      ),
    ).toContain('brackets.0.upTo');
    expect(
      paths(
        table([
          { upTo: '-5', rate: '1' },
          { upTo: null, rate: '2' },
        ]),
      ),
    ).toContain('brackets.0.upTo');
  });

  it('rejects an open bracket that is not the last one', () => {
    const input = table([
      { upTo: null, rate: '0' },
      { upTo: '20000', rate: '10' },
    ]);

    expect(paths(input)).toContain('brackets.0.upTo');
  });

  it('rejects a last bracket that has an upper limit', () => {
    const input = table([
      { upTo: '10000', rate: '0' },
      { upTo: '20000', rate: '10' },
    ]);

    expect(paths(input)).toContain('brackets.1.upTo');
  });

  it.each(['0', '12.5', '100', '100.00', '0.01'])('accepts rate %s', (rate) => {
    const input = table([{ upTo: null, rate }]);

    expect(taxTableInputSchema.safeParse(input).success).toBe(true);
  });

  it.each(['12.345', '100.01', '-1', '101', 'abc', ''])(
    'rejects rate %j at brackets.0.rate',
    (rate) => {
      expect(paths(table([{ upTo: null, rate }]))).toContain('brackets.0.rate');
    },
  );

  it('rejects an upper limit with more than 2 decimals', () => {
    const input = table([
      { upTo: '10000.001', rate: '0' },
      { upTo: null, rate: '10' },
    ]);

    expect(paths(input)).toContain('brackets.0.upTo');
  });

  it('does not require rates to increase', () => {
    const input = table([
      { upTo: '10000', rate: '30' },
      { upTo: null, rate: '5' },
    ]);

    expect(taxTableInputSchema.safeParse(input).success).toBe(true);
  });

  it('trims the name', () => {
    const parsed = taxTableInputSchema.parse(table(standard, '  Exempt  '));

    expect(parsed.name).toBe('Exempt');
  });

  it('rejects a blank name and a name over 60 characters', () => {
    expect(paths(table(standard, '   '))).toContain('name');
    expect(paths(table(standard, 'x'.repeat(61)))).toContain('name');
  });

  it('accepts a name of exactly 60 characters', () => {
    const input = table(standard, 'x'.repeat(60));

    expect(taxTableInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects unknown keys (strict)', () => {
    expect(paths({ ...table(standard), isDefault: true })).toContain(
      'isDefault',
    );
  });
});

describe('taxBracketInputSchema', () => {
  it('rejects unknown keys (strict)', () => {
    const result = taxBracketInputSchema.safeParse({
      upTo: null,
      rate: '10',
      extra: 1,
    });

    expect(result.success).toBe(false);
  });
});
