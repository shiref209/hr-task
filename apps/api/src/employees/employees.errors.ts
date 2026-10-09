import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../common/errors/domain-errors';

export class EmployeeNotFoundError extends NotFoundError {
  constructor() {
    super('Employee not found.');
  }
}

export class EmailAlreadyUsedError extends ConflictError {
  constructor(ownerIsDeleted: boolean) {
    super(
      ownerIsDeleted
        ? 'Email belongs to a deleted employee; restore them instead of creating a new record.'
        : 'Email is already used by another employee.',
    );
  }
}

export class EmployeeNotDeletedError extends ConflictError {
  constructor() {
    super('Employee is not deleted.');
  }
}

export class LastHrError extends BusinessRuleError {
  constructor() {
    super(
      'The last active HR employee cannot be deleted, deactivated or demoted.',
    );
  }
}

export class DepartmentNotFoundError extends ValidationError {
  constructor() {
    super({ departmentId: ['Department does not exist'] });
  }
}

export class UnknownTaxTableError extends ValidationError {
  constructor() {
    super({ taxTableId: ['Select a tax table'] });
  }
}
