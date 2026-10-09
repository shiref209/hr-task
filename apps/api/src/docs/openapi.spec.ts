import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../configure-app';
import { DepartmentsModule } from '../departments/departments.module';
import { DEPARTMENT_REPOSITORY } from '../departments/departments.repository';
import { EmployeesModule } from '../employees/employees.module';
import { EMPLOYEE_REPOSITORY } from '../employees/employees.repository';
import { FILE_STORAGE } from '../employees/profile-image/file-storage';
import { InMemoryDepartmentRepository } from '../../test/fakes/in-memory-department-repository';
import { InMemoryEmployeeRepository } from '../../test/fakes/in-memory-employee-repository';
import { InMemoryFileStorage } from '../../test/fakes/in-memory-file-storage';
import { buildOpenApiDocument } from './openapi';
import { TAX_TABLE_REPOSITORY } from '../payroll/tax-tables/tax-tables.repository';
import { SOCIAL_INSURANCE_REPOSITORY } from '../payroll/social-insurance/social-insurance.repository';
import { InMemoryTaxTableRepository } from '../../test/fakes/in-memory-tax-table-repository';
import { InMemorySocialInsuranceRepository } from '../../test/fakes/in-memory-social-insurance-repository';

describe('buildOpenApiDocument', () => {
  let app: INestApplication;

  beforeAll(async () => {
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
      .useValue(new InMemoryDepartmentRepository([]))
      .overrideProvider(FILE_STORAGE)
      .useValue(new InMemoryFileStorage())
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('is deterministic: two builds are deep-equal', () => {
    expect(buildOpenApiDocument(app)).toEqual(buildOpenApiDocument(app));
  });

  it('titles the document "HR Payroll API"', () => {
    expect(buildOpenApiDocument(app).info.title).toBe('HR Payroll API');
  });
});
