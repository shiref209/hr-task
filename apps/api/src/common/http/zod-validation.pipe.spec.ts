import { z } from 'zod';
import { ValidationError } from '../errors/domain-errors';
import { ZodValidationPipe } from './zod-validation.pipe';

function errorsOf(fn: () => unknown): Record<string, string[]> {
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError) return e.errors;
    throw e;
  }
  throw new Error('expected ValidationError, nothing thrown');
}

const meta = { type: 'body' as const };

describe('ZodValidationPipe', () => {
  it('returns parsed output with defaults applied', () => {
    const pipe = new ZodValidationPipe(
      z.object({ name: z.string(), page: z.number().default(1) }),
    );

    expect(pipe.transform({ name: 'Ada' }, meta)).toEqual({
      name: 'Ada',
      page: 1,
    });
  });

  it('applies transforms from the schema', () => {
    const pipe = new ZodValidationPipe(z.object({ n: z.coerce.number() }));

    expect(pipe.transform({ n: '5' }, meta)).toEqual({ n: 5 });
  });

  it('reports all failing fields at once', () => {
    const pipe = new ZodValidationPipe(
      z.object({ name: z.string(), age: z.number() }),
    );

    const errors = errorsOf(() => pipe.transform({}, meta));

    expect(Object.keys(errors).sort()).toEqual(['age', 'name']);
  });

  it('uses dot paths for nested and array fields', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        address: z.object({ city: z.string() }),
        allowances: z.array(z.object({ amount: z.string() })),
      }),
    );

    const errors = errorsOf(() =>
      pipe.transform({ address: {}, allowances: [{ amount: 1 }] }, meta),
    );

    expect(Object.keys(errors).sort()).toEqual([
      'address.city',
      'allowances.0.amount',
    ]);
  });

  it('puts path-less issues under _root', () => {
    const pipe = new ZodValidationPipe(
      z
        .object({ a: z.number() })
        .refine(() => false, { message: 'whole object bad' }),
    );

    expect(errorsOf(() => pipe.transform({ a: 1 }, meta))).toEqual({
      _root: ['whole object bad'],
    });
  });

  it('reports one Unknown field entry per unrecognized key of a strict object', () => {
    const pipe = new ZodValidationPipe(z.strictObject({ name: z.string() }));

    expect(
      errorsOf(() => pipe.transform({ name: 'x', foo: 1, bar: 2 }, meta)),
    ).toEqual({
      foo: ['Unknown field'],
      bar: ['Unknown field'],
    });
  });

  it('collects several messages for one field', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        pw: z.string().min(8, 'too short').regex(/\d/, 'needs a digit'),
      }),
    );

    const errors = errorsOf(() => pipe.transform({ pw: 'abc' }, meta));

    expect([...errors.pw].sort()).toEqual(['needs a digit', 'too short']);
  });

  it('throws a ValidationError instance', () => {
    const pipe = new ZodValidationPipe(z.object({ name: z.string() }));

    expect(() => pipe.transform({}, meta)).toThrow(ValidationError);
  });
});
