import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ProblemDetails, ProblemType } from '@hr/types';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'http';
import {
  BusinessRuleError,
  ConflictError,
  MalformedRequestError,
  DomainError,
  NotFoundError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../errors/domain-errors';

interface Kind {
  status: number;
  type: string;
  title: string;
}

const KINDS = {
  validation: {
    status: 400,
    type: ProblemType.validationError,
    title: 'Validation failed',
  },
  malformed: {
    status: 400,
    type: ProblemType.malformedRequest,
    title: 'Malformed request',
  },
  notFound: {
    status: 404,
    type: ProblemType.notFound,
    title: 'Resource not found',
  },
  conflict: { status: 409, type: ProblemType.conflict, title: 'Conflict' },
  tooLarge: {
    status: 413,
    type: ProblemType.payloadTooLarge,
    title: 'Payload too large',
  },
  unsupported: {
    status: 415,
    type: ProblemType.unsupportedMediaType,
    title: 'Unsupported media type',
  },
  businessRule: {
    status: 422,
    type: ProblemType.businessRuleViolation,
    title: 'Business rule violation',
  },
} satisfies Record<string, Kind>;

// Adding a domain error kind = one entry here.
const DOMAIN_KINDS: [new (...args: never[]) => DomainError, Kind][] = [
  [ValidationError, KINDS.validation],
  [MalformedRequestError, KINDS.malformed],
  [NotFoundError, KINDS.notFound],
  [ConflictError, KINDS.conflict],
  [UnsupportedMediaTypeError, KINDS.unsupported],
  [BusinessRuleError, KINDS.businessRule],
];

const HTTP_KINDS: Record<number, Kind> = {
  404: KINDS.notFound,
  413: KINDS.tooLarge,
  415: KINDS.unsupported,
};

@Catch()
export class ErrorDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const problem = {
      ...this.toProblem(exception),
      instance: request.path,
    };
    http
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof DomainError) {
      const kind = DOMAIN_KINDS.find(
        ([ctor]) => exception instanceof ctor,
      )?.[1];
      if (!kind) return this.unexpected(exception, 500);
      const errors =
        exception instanceof ValidationError
          ? { errors: exception.errors }
          : {};
      return { ...kind, detail: exception.message, ...errors };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) return this.unexpected(exception, status);
      const kind = HTTP_KINDS[status] ?? {
        status,
        type: 'about:blank',
        title: STATUS_CODES[status] ?? 'Error',
      };
      return { ...kind, detail: exception.message };
    }
    return this.unexpected(exception, 500);
  }

  // Logs the original; the client only ever sees the generic detail.
  private unexpected(exception: unknown, status: number): ProblemDetails {
    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
    return {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Internal Server Error',
      status,
      detail: 'An unexpected error occurred.',
    };
  }
}
