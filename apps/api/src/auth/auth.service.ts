import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '@hr/types';
import { PinoLogger } from 'nestjs-pino';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '../common/clock';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_MS,
  SESSION_MAX_MS,
  type AuthTokens,
} from './auth-cookies';
import { InvalidCredentialsError, SessionExpiredError } from './auth.errors';
import { logAuthEvent } from '../logging/auth-events';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './refresh-tokens.repository';
import {
  canSignIn,
  USER_REPOSITORY,
  type UserAccount,
  type UserRepository,
} from './users.repository';

export interface Session extends AuthTokens {
  user: AuthUser;
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const toAuthUser = (account: UserAccount): AuthUser => ({
  id: account.id,
  email: account.email,
  role: account.employee.type,
  employee: { id: account.employee.id, fullName: account.employee.fullName },
});

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly logger: PinoLogger,
  ) {}

  async login(email: string, password: string): Promise<Session> {
    const account = await this.users.findByEmail(email);
    // Verify even for unknown emails so the response time doesn't reveal whether the account exists.
    const matches = await this.hasher.verify(
      password,
      account?.passwordHash ?? (await this.getDummyHash()),
    );
    if (!account || !matches || !canSignIn(account)) {
      logAuthEvent(this.logger, 'auth.login.failed', {});
      throw new InvalidCredentialsError();
    }
    const now = this.clock.now();
    await this.refreshTokens.deleteExpired(account.id, now);
    const session = await this.startSession(account, now);
    logAuthEvent(this.logger, 'auth.login.succeeded', { userId: account.id });
    return session;
  }

  async refresh(rawToken: string | undefined): Promise<Session> {
    const stored = rawToken
      ? await this.refreshTokens.findByHash(sha256(rawToken))
      : null;
    if (!stored) throw new SessionExpiredError();
    const now = this.clock.now();
    if (
      stored.expiresAt <= now ||
      stored.sessionStartedAt.getTime() + SESSION_MAX_MS <= now.getTime()
    ) {
      await this.refreshTokens.delete(stored.id);
      throw new SessionExpiredError();
    }
    if (stored.revokedAt) {
      // A rotated token is only ever replayed by someone who copied it: end every session of that user.
      await this.revokeAllAfterReuse(stored.userId);
      throw new SessionExpiredError();
    }
    const account = await this.users.findById(stored.userId);
    if (!account || !canSignIn(account)) {
      await this.refreshTokens.revoke(stored.id);
      throw new SessionExpiredError();
    }
    // Losing the compare-and-set means a concurrent refresh already used this token: treat it as reuse.
    if (!(await this.refreshTokens.revoke(stored.id))) {
      await this.revokeAllAfterReuse(stored.userId);
      throw new SessionExpiredError();
    }
    return this.startSession(account, stored.sessionStartedAt);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokens.findByHash(sha256(rawToken));
    if (!stored) return;
    await this.refreshTokens.delete(stored.id);
    logAuthEvent(this.logger, 'auth.logout', { userId: stored.userId });
  }

  async me(userId: string): Promise<AuthUser> {
    const account = await this.users.findById(userId);
    if (!account || !canSignIn(account)) throw new SessionExpiredError();
    return toAuthUser(account);
  }

  private async revokeAllAfterReuse(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
    logAuthEvent(this.logger, 'auth.refresh.reuse_detected', { userId });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomUUID());
    return this.dummyHash;
  }

  private async startSession(
    account: UserAccount,
    sessionStartedAt: Date,
  ): Promise<Session> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(
      this.clock.now().getTime() + REFRESH_TTL_MS,
    );
    await this.refreshTokens.create({
      userId: account.id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiresAt,
      sessionStartedAt,
    });
    // jti keeps two tokens minted in the same second distinct.
    const accessToken = await this.jwt.signAsync(
      {
        sub: account.id,
        employeeId: account.employee.id,
        role: account.employee.type,
      },
      { expiresIn: ACCESS_TTL_SECONDS, jwtid: randomUUID() },
    );
    return {
      user: toAuthUser(account),
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }
}
