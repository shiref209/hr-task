import { Module } from '@nestjs/common';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, DepartmentsModule, EmployeesModule, PayrollModule],
})
export class AppModule {}
