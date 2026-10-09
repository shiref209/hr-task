import { Module } from '@nestjs/common';
import { PayItemsModule } from './pay-items/pay-items.module';
import { PayslipModule } from './payslip/payslip.module';
import { SocialInsuranceModule } from './social-insurance/social-insurance.module';
import { TaxTablesModule } from './tax-tables/tax-tables.module';

@Module({
  imports: [
    TaxTablesModule,
    SocialInsuranceModule,
    PayItemsModule,
    PayslipModule,
  ],
})
export class PayrollModule {}
