import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  INestApplication,
  Module,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';
import { ProblemType } from '@hr/types';
import { configureApp } from '../src/configure-app';
import { ConflictError } from '../src/common/errors/domain-errors';
import { PaginatedResult } from '../src/common/http/paginated-result';
import { ZodValidationPipe } from '../src/common/http/zod-validation.pipe';

const createSchema = z.strictObject({
  name: z.string(),
  age: z.number().int(),
  role: z.string().default('staff'),
});

@Controller('foundation')
class FoundationTestController {
  @Get('object')
  object() {
    return { id: 1 };
  }

  @Get('page')
  page() {
    return new PaginatedResult(['a', 'b'], 1, 2, 5);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createSchema))
    body: z.infer<typeof createSchema>,
  ) {
    return body;
  }

  @Delete('item')
  @HttpCode(204)
  remove(): void {
    return undefined;
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail');
  }

  @Post('bad-request')
  badRequest(): never {
    throw new BadRequestException('custom');
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictError('Email already exists');
  }
}

@Module({ controllers: [FoundationTestController] })
class FoundationTestModule {}

describe('API foundation (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FoundationTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('wraps a returned object in { data }', async () => {
    const res = await http().get('/foundation/object').expect(200);

    expect(res.body).toEqual({ data: { id: 1 } });
  });

  it('returns { data, meta } for a PaginatedResult', async () => {
    const res = await http().get('/foundation/page').expect(200);

    expect(res.body).toEqual({
      data: ['a', 'b'],
      meta: { page: 1, pageSize: 2, totalItems: 5, totalPages: 3 },
    });
  });

  it('returns 201 with the envelope and defaults applied on valid POST', async () => {
    const res = await http()
      .post('/foundation')
      .send({ name: 'Ada', age: 36 })
      .expect(201);

    expect(res.body).toEqual({ data: { name: 'Ada', age: 36, role: 'staff' } });
  });

  it('returns 204 with an empty body for DELETE', async () => {
    const res = await http().delete('/foundation/item').expect(204);

    expect(res.text).toBe('');
  });

  it('returns 400 validation-error with all failing fields', async () => {
    const res = await http()
      .post('/foundation')
      .send({ name: 1, age: 'x' })
      .expect(400);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: ProblemType.validationError,
      status: 400,
      instance: '/foundation',
    });
    expect(Object.keys(res.body.errors).sort()).toEqual(['age', 'name']);
  });

  it('rejects an unknown body key with 400 and Unknown field', async () => {
    const res = await http()
      .post('/foundation')
      .send({ name: 'Ada', age: 1, extra: true })
      .expect(400);

    expect(res.body.type).toBe(ProblemType.validationError);
    expect(res.body.errors).toEqual({ extra: ['Unknown field'] });
  });

  it('returns 400 malformed-request for a malformed JSON body', async () => {
    const res = await http()
      .post('/foundation')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: ProblemType.malformedRequest,
      status: 400,
    });
  });

  it('keeps a handler-thrown BadRequestException on a JSON POST as about:blank', async () => {
    const res = await http()
      .post('/foundation/bad-request')
      .send({ a: 1 })
      .expect(400);

    expect(res.body).toMatchObject({ type: 'about:blank', status: 400 });
  });

  it('returns a 404 not-found problem for an unknown route, instance without query', async () => {
    const res = await http().get('/nope?x=1').expect(404);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: ProblemType.notFound,
      status: 404,
      instance: '/nope',
    });
  });

  it('returns 409 conflict for ConflictError', async () => {
    const res = await http().get('/foundation/conflict').expect(409);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ type: ProblemType.conflict, status: 409 });
  });

  it('returns 500 without leaking the error message or stack', async () => {
    const res = await http().get('/foundation/boom').expect(500);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ type: 'about:blank', status: 500 });
    expect(res.text).not.toContain('secret internal detail');
    expect(res.text).not.toContain('.ts:');
  });
});
