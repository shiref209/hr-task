import type { NextFunction, Request, Response } from 'express';
import { MalformedRequestError } from '../errors/domain-errors';

export function jsonParseErrorMiddleware(
  error: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const isParseFailure =
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed';
  next(
    isParseFailure
      ? new MalformedRequestError('Request body is not valid JSON.')
      : error,
  );
}
