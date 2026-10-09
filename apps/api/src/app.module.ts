import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DepartmentsModule,
    EmployeesModule,
    PayrollModule,
  ],
})
export class AppModule {}
