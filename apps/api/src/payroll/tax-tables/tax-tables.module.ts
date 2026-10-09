import { Module } from '@nestjs/common';
import { EmployeesModule } from '../../employees/employees.module';
import { PayrollRepositoriesModule } from '../payroll-repositories.module';
import { MyTaxTableController } from './my-tax-table.controller';
import { MyTaxTableService } from './my-tax-table.service';
import { TaxTablesController } from './tax-tables.controller';
import { TaxTablesService } from './tax-tables.service';

@Module({
  imports: [PayrollRepositoriesModule, EmployeesModule],
  controllers: [TaxTablesController, MyTaxTableController],
  providers: [TaxTablesService, MyTaxTableService],
})
export class TaxTablesModule {}
