import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthModule } from '../src/auth/auth.module';
import type { UserAccount } from '../src/auth/users.repository';
import { CLOCK } from '../src/common/clock';
import { configureApp } from '../src/configure-app';
import { DepartmentsModule } from '../src/departments/departments.module';
import { DEPARTMENT_REPOSITORY } from '../src/departments/departments.repository';
import { EmployeesModule } from '../src/employees/employees.module';
import { EMPLOYEE_REPOSITORY } from '../src/employees/employees.repository';
import { FILE_STORAGE } from '../src/employees/profile-image/file-storage';
import { PAY_ITEM_REPOSITORY } from '../src/payroll/pay-items/pay-items.repository';
import { PayrollModule } from '../src/payroll/payroll.module';
import { SOCIAL_INSURANCE_REPOSITORY } from '../src/payroll/social-insurance/social-insurance.repository';
import { TAX_TABLE_REPOSITORY } from '../src/payroll/tax-tables/tax-tables.repository';
import { withAuthFakes } from './auth';
import { FixedClock } from './fakes/fixed-clock';
import { InMemoryDepartmentRepository } from './fakes/in-memory-department-repository';
import { InMemoryEmployeeRepository } from './fakes/in-memory-employee-repository';
import { InMemoryFileStorage } from './fakes/in-memory-file-storage';
import { InMemoryPayItemRepository } from './fakes/in-memory-pay-item-repository';
import { InMemorySocialInsuranceRepository } from './fakes/in-memory-social-insurance-repository';
import { InMemoryTaxTableRepository } from './fakes/in-memory-tax-table-repository';

type TestAppFakes = {
  users?: UserAccount[];
  employees?: InMemoryEmployeeRepository;
  departments?: InMemoryDepartmentRepository;
  fileStorage?: InMemoryFileStorage;
  taxTables?: InMemoryTaxTableRepository;
  socialInsurance?: InMemorySocialInsuranceRepository;
  payItems?: InMemoryPayItemRepository;
  /** Runs after `configureApp`, before `init` (e.g. to mount Swagger). */
  beforeInit?: (app: INestApplication) => void;
};

/** The full app over in-memory fakes and a clock fixed at 2026-10-08. */
export async function createTestApp(
  fakes: TestAppFakes = {},
): Promise<{ app: INestApplication; moduleRef: TestingModule }> {
  const moduleRef = await withAuthFakes(
    Test.createTestingModule({
      imports: [AuthModule, EmployeesModule, DepartmentsModule, PayrollModule],
    }),
    fakes.users,
  )
    .overrideProvider(EMPLOYEE_REPOSITORY)
    .useValue(fakes.employees ?? new InMemoryEmployeeRepository())
    .overrideProvider(DEPARTMENT_REPOSITORY)
    .useValue(fakes.departments ?? new InMemoryDepartmentRepository())
    .overrideProvider(FILE_STORAGE)
    .useValue(fakes.fileStorage ?? new InMemoryFileStorage())
    .overrideProvider(TAX_TABLE_REPOSITORY)
    .useValue(fakes.taxTables ?? new InMemoryTaxTableRepository())
    .overrideProvider(SOCIAL_INSURANCE_REPOSITORY)
    .useValue(fakes.socialInsurance ?? new InMemorySocialInsuranceRepository())
    .overrideProvider(PAY_ITEM_REPOSITORY)
    .useValue(fakes.payItems ?? new InMemoryPayItemRepository())
    .overrideProvider(CLOCK)
    .useValue(new FixedClock(new Date('2026-10-08T10:00:00.000Z')))
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  fakes.beforeInit?.(app);
  await app.init();
  return { app, moduleRef };
}
