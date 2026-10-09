import { Module } from '@nestjs/common';
import { PrismaSocialInsuranceRepository } from './social-insurance/prisma-social-insurance.repository';
import { SOCIAL_INSURANCE_REPOSITORY } from './social-insurance/social-insurance.repository';
import { PrismaTaxTablesRepository } from './tax-tables/prisma-tax-tables.repository';
import { TAX_TABLE_REPOSITORY } from './tax-tables/tax-tables.repository';

// Settings repositories shared by the settings services, payslip and employees (pay items stay in PayItemsModule), so no module has to import another feature module for a repository.
const repositories = [
  { provide: TAX_TABLE_REPOSITORY, useClass: PrismaTaxTablesRepository },
  {
    provide: SOCIAL_INSURANCE_REPOSITORY,
    useClass: PrismaSocialInsuranceRepository,
  },
];

@Module({
  providers: repositories,
  exports: repositories.map(({ provide }) => provide),
})
export class PayrollRepositoriesModule {}
