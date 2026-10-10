import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { PaginatedResult } from './paginated-result';
import { RAW_RESPONSE_KEY } from './raw-response.decorator';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector?: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (
      this.reflector?.get<boolean | undefined>(
        RAW_RESPONSE_KEY,
        context.getHandler(),
      )
    )
      return next.handle();
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
