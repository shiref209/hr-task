import {
  ConflictError,
  NotFoundError,
} from '../../common/errors/domain-errors';

export class TaxTableNotFoundError extends NotFoundError {
  constructor() {
    super('Tax table not found.');
  }
}

export class TaxTableNameTakenError extends ConflictError {
  constructor() {
    super('A tax table with this name already exists.');
  }
}

export class DefaultTaxTableDeletionError extends ConflictError {
  constructor() {
    super(
      'The default tax table cannot be deleted. Choose another default first.',
    );
  }
}

export class TaxTableInUseError extends ConflictError {
  constructor(employeeCount?: number) {
    super(
      employeeCount === undefined
        ? 'Tax table is in use by employees.'
        : `Tax table is in use. Used by ${employeeCount} ${employeeCount === 1 ? 'employee' : 'employees'}.`,
    );
  }
}
