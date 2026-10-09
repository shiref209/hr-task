import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';

type SharedSchema = Parameters<typeof zodResolver>[0];

/** Validates the API-shaped input derived from the form values with a shared schema; form values pass through untouched. */
export function schemaResolver<V extends FieldValues>(
  schema: SharedSchema,
  toInput: (values: V) => unknown,
): Resolver<V> {
  const validate = zodResolver(schema) as unknown as Resolver<V>;
  return async (values, context, options) => {
    const result = await validate(toInput(values) as V, context, options);
    return Object.keys(result.errors).length > 0
      ? { values: {}, errors: result.errors }
      : { values, errors: {} };
  };
}
