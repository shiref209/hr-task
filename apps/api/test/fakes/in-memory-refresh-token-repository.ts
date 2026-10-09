import { randomUUID } from 'node:crypto';
import type { RefreshTokenRepository } from '../../src/auth/refresh-tokens.repository';

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  sessionStartedAt: Date;
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private rows: StoredRefreshToken[] = [];

  /** Every stored row, revoked ones included. */
  get all(): StoredRefreshToken[] {
    return this.rows.map((r) => ({ ...r }));
  }

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    sessionStartedAt: Date;
  }): Promise<void> {
    if (this.rows.some((r) => r.tokenHash === input.tokenHash))
      throw new Error('InMemoryRefreshTokenRepository: duplicate tokenHash');
    this.rows.push({ id: randomUUID(), revokedAt: null, ...input });
  }

  async findByHash(hash: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    sessionStartedAt: Date;
  } | null> {
    const row = this.rows.find((r) => r.tokenHash === hash);
    return row ? { ...row } : null;
  }

  /** True only when this call revoked a not-yet-revoked row (compare-and-set). */
  async revoke(id: string): Promise<boolean> {
    const row = this.rows.find((r) => r.id === id);
    if (!row || row.revokedAt) return false;
    row.revokedAt = new Date();
    return true;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const row of this.rows) {
      if (row.userId === userId && !row.revokedAt) row.revokedAt = new Date();
    }
  }

  /** Revoked rows stay: they are what lets reuse of a rotated token be detected. */
  async deleteExpired(userId: string, now: Date): Promise<void> {
    this.rows = this.rows.filter(
      (r) => r.userId !== userId || r.expiresAt > now,
    );
  }

  async delete(id: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}
