import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  RefreshTokenRepository,
  StoredRefreshToken,
} from './refresh-tokens.repository';

@Injectable()
export class PrismaRefreshTokensRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    sessionStartedAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data: input });
  }

  findByHash(hash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        sessionStartedAt: true,
      },
    });
  }

  async revoke(id: string): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpiredAndRevoked(userId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }],
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { id } });
  }
}
