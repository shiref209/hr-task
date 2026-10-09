import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { catchError, Observable, throwError } from 'rxjs';
import { clearAuthCookies } from './auth-cookies';

// Headers set here survive the error filter, so a failed refresh also signs the browser out.
@Injectable()
export class ClearCookiesOnErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      catchError((error: unknown) => {
        clearAuthCookies(res);
        return throwError(() => error);
      }),
    );
  }
}
