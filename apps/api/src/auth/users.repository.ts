import type { EmployeeStatus, EmployeeType } from '@hr/types';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  employee: {
    id: string;
    fullName: string;
    type: EmployeeType;
    status: EmployeeStatus;
    deletedAt: string | null;
  };
}

export interface UserRepository {
  /** Expects a lowercased email. */
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
}

export const canSignIn = ({ employee }: UserAccount): boolean =>
  employee.status === 'ACTIVE' && employee.deletedAt === null;
