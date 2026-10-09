import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListQuery,
  UpdateEmployeeInput,
} from '@hr/types';

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');

export type EmployeeChanges = UpdateEmployeeInput & {
  deletedAt?: Date | null;
  profileImageUrl?: string | null;
};

export interface EmployeeRepository {
  findById(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Employee | null>;
  /** Includes soft-deleted employees: email stays unique forever. */
  findByEmail(email: string): Promise<Employee | null>;
  list(
    query: EmployeeListQuery,
  ): Promise<{ items: Employee[]; totalItems: number }>;
  create(input: CreateEmployeeInput): Promise<Employee>;
  update(id: string, changes: EmployeeChanges): Promise<Employee>;
  /** ACTIVE, type HR, not deleted. */
  countActiveHr(): Promise<number>;
}
