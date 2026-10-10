import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DATABASE_HEALTH = Symbol('DATABASE_HEALTH');

export interface DatabaseHealth {
  /** Resolves when the database answers; rejects otherwise. */
  ping(): Promise<void>;
}

@Injectable()
export class PrismaDatabaseHealth implements DatabaseHealth {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
