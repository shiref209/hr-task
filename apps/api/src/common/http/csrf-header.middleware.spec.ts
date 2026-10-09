import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors/domain-errors';
import { csrfHeaderMiddleware } from './csrf-header.middleware';

function run(method: string, headers: Record<string, string> = {}): unknown[] {
  const lookup = (name: string) => headers[name.toLowerCase()];
  const req = {
    method,
    headers,
    get: lookup,
    header: lookup,
  } as unknown as Request;
  const next = jest.fn();
  csrfHeaderMiddleware(req, {} as Response, next as NextFunction);
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0] as unknown[];
}

const OK = { 'x-requested-with': 'hr-payroll' };

describe('csrfHeaderMiddleware', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'lets %s through without the header',
    (method) => {
      expect(run(method)).toEqual([]);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects %s without the header with ForbiddenError',
    (method) => {
      const [error] = run(method);

      expect(error).toBeInstanceOf(ForbiddenError);
    },
  );

  it('rejects a header with the wrong value', () => {
    const [error] = run('POST', { 'x-requested-with': 'XMLHttpRequest' });

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'lets %s through with X-Requested-With: hr-payroll',
    (method) => {
      expect(run(method, OK)).toEqual([]);
    },
  );
});
