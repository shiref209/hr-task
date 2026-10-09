import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { CLOCK, SystemClock } from '../common/clock';
import { appConfig } from '../common/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PASSWORD_HASHER } from './password-hasher';
import { PrismaRefreshTokensRepository } from './prisma-refresh-tokens.repository';
import { PrismaUsersRepository } from './prisma-users.repository';
import { REFRESH_TOKEN_REPOSITORY } from './refresh-tokens.repository';
import { RolesGuard } from './roles.guard';
import { ScryptPasswordHasher } from './scrypt-password-hasher';
import { USER_REPOSITORY } from './users.repository';

@Module({
  imports: [
    JwtModule.register({ secret: appConfig.JWT_ACCESS_SECRET }),
    // Applied only where LoginThrottlerGuard is used, not globally.
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: appConfig.LOGIN_RATE_LIMIT_PER_MINUTE },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: CLOCK, useClass: SystemClock },
    { provide: PASSWORD_HASHER, useFactory: () => new ScryptPasswordHasher() },
    { provide: USER_REPOSITORY, useClass: PrismaUsersRepository },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokensRepository,
    },
    // Order matters: authenticate first, then check the role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
