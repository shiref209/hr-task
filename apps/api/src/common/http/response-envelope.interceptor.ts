import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { ApiResponse } from '@hr/types';
import { map, Observable } from 'rxjs';
import { PaginatedResult } from './paginated-result';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown> | undefined> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value === undefined) return undefined;
        if (value instanceof PaginatedResult)
          return { data: value.items, meta: value.meta };
        return { data: value };
      }),
    );
  }
}
