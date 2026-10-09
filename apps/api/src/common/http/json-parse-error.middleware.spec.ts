import { NextFunction, Request, Response } from 'express';
import { MalformedRequestError, NotFoundError } from '../errors/domain-errors';
import { jsonParseErrorMiddleware } from './json-parse-error.middleware';

function run(error: unknown): unknown[] {
  const next = jest.fn();
  jsonParseErrorMiddleware(
    error,
    {} as Request,
    {} as Response,
    next as NextFunction,
  );
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0] as unknown[];
}

describe('jsonParseErrorMiddleware', () => {
  it('maps a body-parser entity.parse.failed error to MalformedRequestError', () => {
    const err = Object.assign(new SyntaxError('Unexpected token }'), {
      type: 'entity.parse.failed',
      status: 400,
    });

    const [arg] = run(err);

    expect(arg).toBeInstanceOf(MalformedRequestError);
    expect((arg as MalformedRequestError).message).toBe(
      'Request body is not valid JSON.',
    );
  });

  it('passes a plain Error through unchanged', () => {
    const err = new Error('boom');

    expect(run(err)[0]).toBe(err);
  });

  it('passes a domain error through unchanged', () => {
    const err = new NotFoundError('nope');

    expect(run(err)[0]).toBe(err);
  });
});
