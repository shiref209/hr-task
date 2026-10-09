import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '../errors/domain-errors';

@Injectable()
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ValidationError(toErrorMap(result.error.issues));
  }
}

function toErrorMap(issues: z.core.$ZodIssue[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (path: PropertyKey[], message: string) => {
    const key = path.map(String).join('.') || '_root';
    (errors[key] ??= []).push(message);
  };
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      issue.keys.forEach((key) => add([...issue.path, key], 'Unknown field'));
    } else {
      add(issue.path, issue.message);
    }
  }
  return errors;
}
