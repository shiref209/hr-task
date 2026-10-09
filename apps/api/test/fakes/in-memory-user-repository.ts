import { randomUUID } from 'node:crypto';
import type {
  UserAccount,
  UserRepository,
} from '../../src/auth/users.repository';

let sequence = 0;

export function aUserAccount(
  overrides: Partial<Omit<UserAccount, 'employee'>> & {
    employee?: Partial<UserAccount['employee']>;
  } = {},
): UserAccount {
  sequence += 1;
  const { employee, ...rest } = overrides;
  return {
    id: randomUUID(),
    email: `user${sequence}@example.com`,
    passwordHash: 'fake$password',
    ...rest,
    employee: {
      id: randomUUID(),
      fullName: `User ${sequence}`,
      type: 'EMPLOYEE',
      status: 'ACTIVE',
      deletedAt: null,
      ...employee,
    },
  };
}

export class InMemoryUserRepository implements UserRepository {
  private rows: UserAccount[];

  constructor(seed: UserAccount[] = []) {
    this.rows = seed.map((u) => ({ ...u, employee: { ...u.employee } }));
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    return this.rows.find((u) => u.email === email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<UserAccount | null> {
    return this.rows.find((u) => u.id === id) ?? null;
  }

  /** Lets a test change the linked employee after sign-in (edge cases 10, 15). */
  updateEmployee(
    userId: string,
    changes: Partial<UserAccount['employee']>,
  ): void {
    const row = this.rows.find((u) => u.id === userId);
    if (!row) throw new Error(`InMemoryUserRepository: no user ${userId}`);
    row.employee = { ...row.employee, ...changes };
  }
}
