import { Test } from '@nestjs/testing';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { configureApp } from '../configure-app';
import { DepartmentsModule } from '../departments/departments.module';
import { DEPARTMENT_REPOSITORY } from '../departments/departments.repository';
import { EmployeesModule } from '../employees/employees.module';
import { EMPLOYEE_REPOSITORY } from '../employees/employees.repository';
import { FILE_STORAGE } from '../employees/profile-image/file-storage';
import { buildOpenApiDocument } from './openapi';

const OUTPUT = join(__dirname, '../../../../docs/openapi.json');

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, sortKeys(child)]),
    );
  }
  return value;
}

// Routes are only described, never called, so empty stubs keep the export free of a database.
async function exportDocument(): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [EmployeesModule, DepartmentsModule],
  })
    .overrideProvider(EMPLOYEE_REPOSITORY)
    .useValue({})
    .overrideProvider(DEPARTMENT_REPOSITORY)
    .useValue({})
    .overrideProvider(FILE_STORAGE)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const document = buildOpenApiDocument(app);
  await app.close();

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(sortKeys(document), null, 2)}\n`);
}

void exportDocument();
