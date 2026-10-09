import { BusinessRuleError } from '../../common/errors/domain-errors';

export class EmployeeInactiveError extends BusinessRuleError {
  constructor() {
    super('Payslips are only available for active employees.');
  }
}

export class NotYetHiredError extends BusinessRuleError {
  constructor(month: string, hireDate: string) {
    super(`Not yet hired in ${month} (hire date ${hireDate})`);
  }
}
