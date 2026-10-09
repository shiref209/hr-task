import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { PaginatedResult } from './paginated-result';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

async function run(value: unknown): Promise<unknown> {
  const handler: CallHandler = { handle: () => of(value) };
  const ctx = {} as ExecutionContext;
  return lastValueFrom(
    new ResponseEnvelopeInterceptor().intercept(ctx, handler),
  );
}

describe('ResponseEnvelopeInterceptor', () => {
  it('wraps a plain object in data', async () => {
    expect(await run({ id: 1 })).toEqual({ data: { id: 1 } });
  });

  it('wraps a primitive in data', async () => {
    expect(await run('ok')).toEqual({ data: 'ok' });
  });

  it('wraps an array in data without meta', async () => {
    expect(await run([1, 2])).toEqual({ data: [1, 2] });
  });

  it('unwraps a PaginatedResult into data and meta', async () => {
    const result = new PaginatedResult(['a', 'b'], 2, 2, 5);

    expect(await run(result)).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, pageSize: 2, totalItems: 5, totalPages: 3 },
    });
  });

  it('leaves undefined untouched', async () => {
    expect(await run(undefined)).toBeUndefined();
  });
});
