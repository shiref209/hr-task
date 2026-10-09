import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UserAccount, UserRepository } from './users.repository';

const withEmployee = {
  include: {
    employee: {
      select: {
        id: true,
        fullName: true,
        type: true,
        status: true,
        deletedAt: true,
      },
    },
  },
} satisfies Prisma.UserDefaultArgs;

const toUserAccount = (
  row: Prisma.UserGetPayload<typeof withEmployee>,
): UserAccount => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  employee: {
    ...row.employee,
    deletedAt: row.employee.deletedAt?.toISOString() ?? null,
  },
});

@Injectable()
export class PrismaUsersRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      ...withEmployee,
    });
    return row && toUserAccount(row);
  }

  async findById(id: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      ...withEmployee,
    });
    return row && toUserAccount(row);
  }
}
