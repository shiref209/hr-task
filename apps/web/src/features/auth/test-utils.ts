import type { AuthUser, Role } from '@hr/types';

/** Builds the signed-in user as GET /auth/me returns it. */
export function anAuthUser(role: Role = 'HR', overrides: Partial<AuthUser> = {}): AuthUser {
  const isHr = role === 'HR';
  return {
    id: isHr ? '99999999-9999-4999-8999-999999999991' : '99999999-9999-4999-8999-999999999992',
    email: isHr ? 'test@hr.com' : 'test@employee.com',
    role,
    employee: {
      id: isHr ? '88888888-8888-4888-8888-888888888881' : '88888888-8888-4888-8888-888888888882',
      fullName: isHr ? 'Hana Hassan' : 'Omar Farouk',
    },
    ...overrides,
  };
}
