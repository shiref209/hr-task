import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { authUserSchema, loginSchema, type LoginInput } from '@hr/types';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { apiBody, apiEnvelope, apiProblems } from '../docs/zod-openapi';
import {
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth-cookies';
import type { AuthPrincipal } from './auth-principal';
import { ClearCookiesOnErrorInterceptor } from './clear-cookies-on-error.interceptor';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

const sessionSchema = z.object({ user: authUserSchema });
type SessionBody = z.infer<typeof sessionSchema>;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @UseGuards(LoginThrottlerGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in',
    description: 'Sets the httpOnly access_token and refresh_token cookies.',
  })
  @apiBody(loginSchema)
  @apiEnvelope(sessionSchema)
  @apiProblems(400, 401, 429)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) { email, password }: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionBody> {
    const { user, ...tokens } = await this.auth.login(email, password);
    setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @Post('refresh')
  @UseInterceptors(ClearCookiesOnErrorInterceptor)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
    description: 'Reads the refresh_token cookie; no body.',
  })
  @apiEnvelope(sessionSchema)
  @apiProblems(401)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionBody> {
    const { user, ...tokens } = await this.auth.refresh(
      readCookie(req, REFRESH_COOKIE),
    );
    setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sign out of this device',
    description: 'Idempotent. Clears both cookies.',
  })
  @ApiResponse({ status: 204, description: 'Signed out' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'The signed-in user' })
  @apiEnvelope(sessionSchema)
  @apiProblems(401)
  async me(@CurrentUser() principal: AuthPrincipal): Promise<SessionBody> {
    return { user: await this.auth.me(principal.userId) };
  }
}
