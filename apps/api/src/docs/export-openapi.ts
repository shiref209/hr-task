import './placeholder-env';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AuthModule } from '../auth/auth.module';
import { REFRESH_TOKEN_REPOSITORY } from '../auth/refresh-tokens.repository';
import { USER_REPOSITORY } from '../auth/users.repository';
import { configureApp } from '../configure-app';
import { DepartmentsModule } from '../departments/departments.module';
import { DEPARTMENT_REPOSITORY } from '../departments/departments.repository';
import { EmployeesModule } from '../employees/employees.module';
import { EMPLOYEE_REPOSITORY } from '../employees/employees.repository';
import { FILE_STORAGE } from '../employees/profile-image/file-storage';
import { DATABASE_HEALTH } from '../health/database-health';
import { HealthModule } from '../health/health.module';
import { PAY_ITEM_REPOSITORY } from '../payroll/pay-items/pay-items.repository';
import { PayrollModule } from '../payroll/payroll.module';
import { SOCIAL_INSURANCE_REPOSITORY } from '../payroll/social-insurance/social-insurance.repository';
import { TAX_TABLE_REPOSITORY } from '../payroll/tax-tables/tax-tables.repository';
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
    imports: [
      LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
      AuthModule,
      EmployeesModule,
      DepartmentsModule,
      PayrollModule,
      HealthModule,
    ],
  })
    .overrideProvider(USER_REPOSITORY)
    .useValue({})
    .overrideProvider(REFRESH_TOKEN_REPOSITORY)
    .useValue({})
    .overrideProvider(EMPLOYEE_REPOSITORY)
    .useValue({})
    .overrideProvider(DEPARTMENT_REPOSITORY)
    .useValue({})
    .overrideProvider(FILE_STORAGE)
    .useValue({})
    .overrideProvider(TAX_TABLE_REPOSITORY)
    .useValue({})
    .overrideProvider(SOCIAL_INSURANCE_REPOSITORY)
    .useValue({})
    .overrideProvider(PAY_ITEM_REPOSITORY)
    .useValue({})
    .overrideProvider(DATABASE_HEALTH)
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
