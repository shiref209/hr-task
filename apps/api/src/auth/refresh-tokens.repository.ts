export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface StoredRefreshToken {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  /** When the user signed in; carried through rotation to cap the session's lifetime. */
  sessionStartedAt: Date;
}

export interface RefreshTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    sessionStartedAt: Date;
  }): Promise<void>;
  findByHash(hash: string): Promise<StoredRefreshToken | null>;
  /** True only if this call revoked a not-yet-revoked token (compare-and-set). */
  revoke(id: string): Promise<boolean>;
  /** Marks every still-active token of the user revoked. */
  revokeAllForUser(userId: string): Promise<void>;
  /** Housekeeping: drops the user's expired rows. Revoked rows are kept until they expire so a replayed rotated token still triggers reuse detection. */
  deleteExpired(userId: string, now: Date): Promise<void>;
  delete(id: string): Promise<void>;
}
