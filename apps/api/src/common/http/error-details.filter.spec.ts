import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { STATUS_CODES } from 'http';
import { ProblemType } from '@hr/types';
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  MalformedRequestError,
  NotFoundError,
  ValidationError,
} from '../errors/domain-errors';
import { ErrorDetailsFilter } from './error-details.filter';

interface Captured {
  status?: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Fake express response supporting the common ways to set status/headers/body. */
function run(
  exception: unknown,
  url = '/employees/42?x=1',
  extraReq: Record<string, unknown> = {},
): Captured {
  const out: Captured = { headers: {}, body: {} };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
    header(k: string, v: string) {
      return res.setHeader(k, v);
    },
    set(k: string, v: string) {
      return res.setHeader(k, v);
    },
    type(v: string) {
      return res.setHeader('content-type', v);
    },
    contentType(v: string) {
      return res.setHeader('content-type', v);
    },
    json(b: Record<string, unknown>) {
      out.body = b;
      return res;
    },
    send(b: unknown) {
      out.body =
        typeof b === 'string'
          ? (JSON.parse(b) as Record<string, unknown>)
          : (b as Record<string, unknown>);
      return res;
    },
    end() {
      return res;
    },
  };
  const req = {
    url,
    originalUrl: url,
    path: url.split('?')[0],
    ...extraReq,
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  new ErrorDetailsFilter().catch(exception, host);
  return out;
}

describe('ErrorDetailsFilter', () => {
  let loggerError: jest.SpyInstance;
  let staticLoggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    staticLoggerError = jest
      .spyOn(Logger, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('maps ValidationError to 400 validation-error with errors map', () => {
    const out = run(new ValidationError({ name: ['Required'] }));

    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({
      type: ProblemType.validationError,
      status: 400,
      errors: { name: ['Required'] },
    });
    expect(typeof out.body.title).toBe('string');
  });

  it('maps MalformedRequestError to 400 malformed-request', () => {
    const out = run(
      new MalformedRequestError('Request body is not valid JSON.'),
    );

    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({
      type: ProblemType.malformedRequest,
      title: 'Malformed request',
      status: 400,
    });
    expect(out.body.errors).toBeUndefined();
  });

  it('maps a handler-thrown BadRequestException on a JSON request with no body to about:blank, not malformed-request', () => {
    const req = {
      is: (t: string) => (t === 'json' ? 'json' : false),
      body: undefined,
    };

    const out = run(new BadRequestException('x'), '/employees', req);

    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({
      type: 'about:blank',
      title: STATUS_CODES[400],
    });
  });

  it('maps NotFoundError to 404 not-found', () => {
    const out = run(new NotFoundError('Employee not found'));

    expect(out.status).toBe(404);
    expect(out.body).toMatchObject({ type: ProblemType.notFound, status: 404 });
  });

  it('maps Nest NotFoundException (unknown route) to 404 not-found', () => {
    const out = run(new HttpException('Cannot GET /x', 404));

    expect(out.status).toBe(404);
    expect(out.body).toMatchObject({ type: ProblemType.notFound, status: 404 });
  });

  it('maps ConflictError to 409 conflict', () => {
    const out = run(new ConflictError('Email already exists'));

    expect(out.status).toBe(409);
    expect(out.body).toMatchObject({ type: ProblemType.conflict, status: 409 });
  });

  it('maps PayloadTooLargeException to 413 payload-too-large', () => {
    const out = run(new PayloadTooLargeException());

    expect(out.status).toBe(413);
    expect(out.body).toMatchObject({
      type: ProblemType.payloadTooLarge,
      status: 413,
    });
  });

  it('maps UnsupportedMediaTypeException to 415 unsupported-media-type', () => {
    const out = run(new UnsupportedMediaTypeException());

    expect(out.status).toBe(415);
    expect(out.body).toMatchObject({
      type: ProblemType.unsupportedMediaType,
      status: 415,
    });
  });

  it('maps BusinessRuleError to 422 business-rule-violation', () => {
    const out = run(new BusinessRuleError('Employee is inactive'));

    expect(out.status).toBe(422);
    expect(out.body).toMatchObject({
      type: ProblemType.businessRuleViolation,
      status: 422,
    });
  });

  it('maps other HttpException to its status with about:blank and the STATUS_CODES title', () => {
    const out = run(new ForbiddenException());

    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({
      type: 'about:blank',
      title: STATUS_CODES[403],
      status: 403,
    });
  });

  describe('unknown errors', () => {
    it('returns 500 about:blank', () => {
      const out = run(new Error('db password is hunter2'));

      expect(out.status).toBe(500);
      expect(out.body).toMatchObject({
        type: 'about:blank',
        title: STATUS_CODES[500],
        status: 500,
      });
    });

    it('never leaks the message or stack in the body', () => {
      const err = new Error('db password is hunter2');

      const out = run(err);

      const raw = JSON.stringify(out.body);
      expect(raw).not.toContain('hunter2');
      expect(raw).not.toContain('at ');
      expect(out.body.stack).toBeUndefined();
    });

    it('logs the error with the Nest Logger', () => {
      run(new Error('boom'));

      expect(
        loggerError.mock.calls.length + staticLoggerError.mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('handles a non-Error thrown value as 500', () => {
      const out = run('just a string');

      expect(out.status).toBe(500);
      expect(out.body.type).toBe('about:blank');
    });
  });

  describe('5xx and unmapped errors never leak their message', () => {
    const logged = () =>
      loggerError.mock.calls.length + staticLoggerError.mock.calls.length;

    it.each([
      [new InternalServerErrorException('db password leaked'), 500],
      [new ServiceUnavailableException('db password leaked'), 503],
    ])(
      'replaces the detail of %p with the generic one',
      (exception, status) => {
        const out = run(exception);

        expect(out.status).toBe(status);
        expect(out.body).toMatchObject({
          type: 'about:blank',
          title: STATUS_CODES[status],
          status,
          detail: 'An unexpected error occurred.',
        });
        expect(JSON.stringify(out.body)).not.toContain('db password leaked');
        expect(logged()).toBeGreaterThan(0);
      },
    );

    it('maps an unmapped DomainError to a generic 500 and logs it', () => {
      class UnmappedError extends DomainError {}

      const out = run(new UnmappedError('internal rule detail'));

      expect(out.status).toBe(500);
      expect(out.body).toMatchObject({
        type: 'about:blank',
        title: STATUS_CODES[500],
        status: 500,
        detail: 'An unexpected error occurred.',
      });
      expect(JSON.stringify(out.body)).not.toContain('internal rule detail');
      expect(logged()).toBeGreaterThan(0);
    });
  });

  it('does not log 4xx errors as errors', () => {
    run(new NotFoundError('x'));

    expect(loggerError).not.toHaveBeenCalled();
    expect(staticLoggerError).not.toHaveBeenCalled();
  });

  it('sets instance to the request path without the query string', () => {
    const out = run(new NotFoundError('x'), '/employees/42?x=1');

    expect(out.body.instance).toBe('/employees/42');
  });

  it('sets Content-Type to application/problem+json', () => {
    const out = run(new ConflictError('x'));

    expect(out.headers['content-type']).toContain('application/problem+json');
  });

  it('includes errors only for validation problems', () => {
    expect(run(new ConflictError('x')).body.errors).toBeUndefined();
    expect(run(new Error('x')).body.errors).toBeUndefined();
  });

  describe('error log content', () => {
    // Every argument the filter handed to the Nest Logger, as one string.
    const loggedText = () =>
      JSON.stringify(
        [
          ...(loggerError.mock.calls as unknown[][]),
          ...(staticLoggerError.mock.calls as unknown[][]),
        ].flat(),
      );

    class PrismaClientKnownRequestError extends Error {
      readonly code = 'P2002';
      readonly clientVersion = '6.19.3';
      readonly meta = { modelName: 'Employee', target: ['email'] };
      constructor() {
        super(
          'Invalid `prisma.employee.create()` invocation: data: { baseSalary: "9000.00", passwordHash: "$scrypt$abc" }',
        );
        this.name = 'PrismaClientKnownRequestError';
      }
    }

    it('logs only code, model and target for a Prisma error, never its message or stack', () => {
      run(new PrismaClientKnownRequestError());

      const logged = loggedText();
      expect(logged).toContain('P2002');
      expect(logged).toContain('Employee');
      expect(logged).toContain('email');
      expect(logged).not.toContain('baseSalary');
      expect(logged).not.toContain('passwordHash');
      expect(logged).not.toContain('9000.00');
    });

    it('still answers a Prisma error with the generic 500', () => {
      const out = run(new PrismaClientKnownRequestError());

      expect(out.status).toBe(500);
      expect(out.body).toMatchObject({
        type: 'about:blank',
        title: STATUS_CODES[500],
        status: 500,
        detail: 'An unexpected error occurred.',
      });
      expect(JSON.stringify(out.body)).not.toContain('baseSalary');
    });

    it('logs name, message and stack for an unexpected non-Prisma error', () => {
      class WeirdError extends Error {}
      const err = new WeirdError('kaboom');
      err.name = 'WeirdError';

      const out = run(err);

      const logged = loggedText();
      expect(logged).toContain('WeirdError');
      expect(logged).toContain('kaboom');
      expect(logged).toContain(err.stack?.split('\n')[1].trim());
      expect(out.status).toBe(500);
      expect(out.body.detail).toBe('An unexpected error occurred.');
    });
  });
});
