export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(
    readonly errors: Record<string, string[]>,
    message = 'Request validation failed.',
  ) {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {}
export class ForbiddenError extends DomainError {}
export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}
export class BusinessRuleError extends DomainError {}
export class MalformedRequestError extends DomainError {}
export class UnsupportedMediaTypeError extends DomainError {}
