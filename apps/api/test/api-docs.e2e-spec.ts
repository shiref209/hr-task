import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CLOCK } from '../src/common/clock';
import { configureApp } from '../src/configure-app';
import { DepartmentsModule } from '../src/departments/departments.module';
import { DEPARTMENT_REPOSITORY } from '../src/departments/departments.repository';
import { setupSwagger } from '../src/docs/openapi';
import { EmployeesModule } from '../src/employees/employees.module';
import { EMPLOYEE_REPOSITORY } from '../src/employees/employees.repository';
import { FILE_STORAGE } from '../src/employees/profile-image/file-storage';
import {
  ENGINEERING,
  FINANCE,
  HUMAN_RESOURCES,
} from './fakes/employee.builder';
import { FixedClock } from './fakes/fixed-clock';
import { InMemoryDepartmentRepository } from './fakes/in-memory-department-repository';
import { InMemoryEmployeeRepository } from './fakes/in-memory-employee-repository';
import { InMemoryFileStorage } from './fakes/in-memory-file-storage';
import { TAX_TABLE_REPOSITORY } from '../src/payroll/tax-tables/tax-tables.repository';
import { SOCIAL_INSURANCE_REPOSITORY } from '../src/payroll/social-insurance/social-insurance.repository';
import { InMemoryTaxTableRepository } from './fakes/in-memory-tax-table-repository';
import { InMemorySocialInsuranceRepository } from './fakes/in-memory-social-insurance-repository';

type Obj = Record<string, unknown>;

/** Safe deep read: returns undefined as soon as a key is missing. */
const at = (o: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>(
    (cur, k) =>
      cur !== null && typeof cur === 'object' ? (cur as Obj)[k] : undefined,
    o,
  );

const PROBLEM = 'application/problem+json';

async function boot(swaggerEnabled: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [EmployeesModule, DepartmentsModule],
  })
    .overrideProvider(TAX_TABLE_REPOSITORY)
    .useValue(new InMemoryTaxTableRepository())
    .overrideProvider(SOCIAL_INSURANCE_REPOSITORY)
    .useValue(new InMemorySocialInsuranceRepository())
    .overrideProvider(EMPLOYEE_REPOSITORY)
    .useValue(new InMemoryEmployeeRepository([]))
    .overrideProvider(DEPARTMENT_REPOSITORY)
    .useValue(
      new InMemoryDepartmentRepository([HUMAN_RESOURCES, FINANCE, ENGINEERING]),
    )
    .overrideProvider(FILE_STORAGE)
    .useValue(new InMemoryFileStorage())
    .overrideProvider(CLOCK)
    .useValue(new FixedClock(new Date('2026-10-08T10:00:00.000Z')))
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  setupSwagger(app, { enabled: swaggerEnabled });
  await app.init();
  return app;
}

/**
 * Enumerates routes from the Express router stack (the thing that actually
 * serves requests), so any controller added later is picked up without
 * touching this test. Express 5 exposes `router`, Express 4 `_router`.
 */
function registeredRoutes(app: INestApplication): string[] {
  type Layer = {
    route?: { path: string; methods: Record<string, boolean> };
  };
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack: Layer[] };
    _router?: { stack: Layer[] };
  };
  const stack = (instance.router ?? instance._router)?.stack ?? [];
  const out: string[] = [];
  for (const layer of stack) {
    if (!layer.route) continue;
    // Swagger mounts its own UI/json routes; they are never documented.
    const p = layer.route.path;
    if (p === '/docs' || p.startsWith('/docs/') || p.startsWith('/docs-')) {
      continue;
    }
    for (const [method, on] of Object.entries(layer.route.methods)) {
      if (on && method !== '_all') {
        out.push(`${method} ${layer.route.path.replace(/:(\w+)/g, '{$1}')}`);
      }
    }
  }
  return out;
}

const KNOWN_ENDPOINTS = [
  'get /departments',
  'post /employees',
  'get /employees',
  'get /employees/{id}',
  'patch /employees/{id}',
  'delete /employees/{id}',
  'post /employees/{id}/restore',
  'post /employees/{id}/profile-image',
];

describe('API docs (e2e)', () => {
  let app: INestApplication;
  let doc: unknown;

  beforeAll(async () => {
    app = await boot(true);
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    doc = res.body;
  });

  afterAll(async () => {
    await app.close();
  });

  const op = (method: string, path: string): unknown => {
    const found = at(doc, 'paths', path, method);
    if (!found) throw new Error(`missing ${method} ${path} in document`);
    return found;
  };
  const errorSchema = (method: string, path: string, status: number) =>
    at(
      op(method, path),
      'responses',
      String(status),
      'content',
      PROBLEM,
      'schema',
    );

  describe('edge case 1: every route is documented', () => {
    it('documents every route registered in the router', () => {
      const routes = registeredRoutes(app);
      expect(routes.length).toBeGreaterThan(0);

      const documented = Object.entries(at(doc, 'paths') as Obj).flatMap(
        ([path, ops]) => Object.keys(ops as Obj).map((m) => `${m} ${path}`),
      );

      expect(routes.filter((r) => !documented.includes(r))).toEqual([]);
    });

    it('documents the 8 known endpoints', () => {
      for (const entry of KNOWN_ENDPOINTS) {
        const [method, path] = entry.split(' ');
        expect(at(doc, 'paths', path, method)).toBeDefined();
      }
    });
  });

  describe('edge case 2: POST /employees body schema', () => {
    const schema = () =>
      at(
        op('post', '/employees'),
        'requestBody',
        'content',
        'application/json',
        'schema',
      );
    const prop = (name: string) => at(schema(), 'properties', name);

    it('lists the required fields', () => {
      expect(at(schema(), 'required')).toEqual(
        expect.arrayContaining([
          'fullName',
          'email',
          'jobTitle',
          'departmentId',
          'hireDate',
          'baseSalary',
        ]),
      );
    });

    it('is strict (additionalProperties false)', () => {
      expect(at(schema(), 'additionalProperties')).toBe(false);
    });

    it('documents baseSalary as a string with a pattern', () => {
      expect(at(prop('baseSalary'), 'type')).toBe('string');
      expect(typeof at(prop('baseSalary'), 'pattern')).toBe('string');
    });

    it('documents status and type as enums', () => {
      expect(Array.isArray(at(prop('status'), 'enum'))).toBe(true);
      expect(Array.isArray(at(prop('type'), 'enum'))).toBe(true);
    });
  });

  describe('edge case 3: error responses', () => {
    const cases: [string, string, number[]][] = [
      ['post', '/employees', [400, 409]],
      ['patch', '/employees/{id}', [400, 404, 409, 422]],
      ['delete', '/employees/{id}', [404, 422]],
      ['post', '/employees/{id}/restore', [404, 409]],
      ['post', '/employees/{id}/profile-image', [400, 404, 413, 415]],
    ];

    it.each(cases)('%s %s documents %j as problem+json', (m, p, statuses) => {
      for (const s of statuses) {
        expect(errorSchema(m, p, s)).toBeDefined();
      }
    });

    it('references one shared ProblemDetails component everywhere', () => {
      const refs = new Set<unknown>();
      for (const [m, p, statuses] of cases) {
        for (const s of statuses) {
          refs.add(at(errorSchema(m, p, s), '$ref'));
        }
      }

      expect(refs.size).toBe(1);
      const [ref] = [...refs] as string[];
      expect(ref).toMatch(/^#\/components\/schemas\/\w+/);
      const name = ref.split('/').pop() ?? '';
      expect(
        at(doc, 'components', 'schemas', name, 'properties', 'status'),
      ).toBeDefined();
    });
  });

  describe('edge case 4: GET /employees list', () => {
    const params = () => at(op('get', '/employees'), 'parameters') as Obj[];
    const param = (name: string) => params().find((p) => p.name === name);

    it('documents all query parameters', () => {
      expect(params().map((p) => p.name)).toEqual(
        expect.arrayContaining([
          'page',
          'pageSize',
          'search',
          'departmentId',
          'status',
          'type',
          'deleted',
        ]),
      );
    });

    it('documents page and pageSize bounds', () => {
      expect(at(param('page'), 'schema', 'minimum')).toBeDefined();
      expect(at(param('pageSize'), 'schema', 'minimum')).toBeDefined();
      expect(at(param('pageSize'), 'schema', 'maximum')).toBeDefined();
    });

    it('documents status and type as enums', () => {
      expect(Array.isArray(at(param('status'), 'schema', 'enum'))).toBe(true);
      expect(Array.isArray(at(param('type'), 'schema', 'enum'))).toBe(true);
    });

    it('documents a 200 envelope with a data array and meta', () => {
      const schema = at(
        op('get', '/employees'),
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      );

      expect(at(schema, 'properties', 'data', 'type')).toBe('array');
      expect(at(schema, 'properties', 'meta')).toBeDefined();
    });
  });

  describe('edge case 5: profile-image upload', () => {
    const operation = () => op('post', '/employees/{id}/profile-image');

    it('is multipart/form-data with a binary file field', () => {
      const file = at(
        operation(),
        'requestBody',
        'content',
        'multipart/form-data',
        'schema',
        'properties',
        'file',
      );
      expect(at(file, 'type')).toBe('string');
      expect(at(file, 'format')).toBe('binary');
    });

    it('mentions the 2 MB limit and allowed types', () => {
      const text = JSON.stringify(operation());
      expect(text).toMatch(/2\s?MB/i);
      expect(text).toMatch(/jpeg/i);
      expect(text).toMatch(/png/i);
      expect(text).toMatch(/webp/i);
    });
  });

  describe('edge case 6: swagger disabled', () => {
    let off: INestApplication;

    beforeAll(async () => {
      off = await boot(false);
    });

    afterAll(async () => {
      await off.close();
    });

    it.each(['/docs', '/docs-json'])(
      'returns 404 problem+json for GET %s',
      async (path) => {
        const res = await request(off.getHttpServer()).get(path).expect(404);

        expect(res.headers['content-type']).toMatch(
          /application\/problem\+json/,
        );
      },
    );
  });
});
