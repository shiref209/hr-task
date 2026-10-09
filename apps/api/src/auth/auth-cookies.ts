import type { CookieOptions, Request, Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Sign-in age after which a refresh is refused, however often the token was rotated.
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

// Only the refresh cookie is sent to /auth, so it never travels with ordinary API calls.
const baseOptions = (path: string): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path,
});

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions('/'),
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions('/auth'),
    expires: tokens.refreshExpiresAt,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions('/'));
  res.clearCookie(REFRESH_COOKIE, baseOptions('/auth'));
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
