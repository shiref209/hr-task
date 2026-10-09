import { UnauthorizedError } from '../common/errors/domain-errors';

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('Invalid email or password');
  }
}

export class SessionExpiredError extends UnauthorizedError {
  constructor() {
    super('Your session has expired. Sign in again.');
  }
}
