import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors/domain-errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// A cross-site form can't set a custom header, so with SameSite=Strict this stops CSRF.
export function csrfHeaderMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (
    SAFE_METHODS.has(req.method) ||
    req.get('X-Requested-With') === 'hr-payroll'
  )
    return next();
  next(new ForbiddenError('Missing X-Requested-With: hr-payroll header.'));
}
