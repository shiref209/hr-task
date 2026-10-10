import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { PayrollModule } from './payroll/payroll.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    LoggingModule,
    PrismaModule,
    AuthModule,
    DepartmentsModule,
    EmployeesModule,
    PayrollModule,
    HealthModule,
  ],
})
export class AppModule {}
