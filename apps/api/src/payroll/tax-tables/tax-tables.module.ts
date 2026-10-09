import { Module } from '@nestjs/common';
import { PayrollRepositoriesModule } from '../payroll-repositories.module';
import { TaxTablesController } from './tax-tables.controller';
import { TaxTablesService } from './tax-tables.service';

@Module({
  imports: [PayrollRepositoriesModule],
  controllers: [TaxTablesController],
  providers: [TaxTablesService],
})
export class TaxTablesModule {}
