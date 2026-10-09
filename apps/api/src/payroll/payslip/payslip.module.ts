import { Module } from '@nestjs/common';
import { EmployeesModule } from '../../employees/employees.module';
import { PayItemsModule } from '../pay-items/pay-items.module';
import { PayrollRepositoriesModule } from '../payroll-repositories.module';
import { PayslipController } from './payslip.controller';
import { PayslipService } from './payslip.service';

@Module({
  imports: [EmployeesModule, PayrollRepositoriesModule, PayItemsModule],
  controllers: [PayslipController],
  providers: [PayslipService],
})
export class PayslipModule {}
