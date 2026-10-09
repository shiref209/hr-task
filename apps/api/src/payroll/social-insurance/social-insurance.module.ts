import { Module } from '@nestjs/common';
import { PayrollRepositoriesModule } from '../payroll-repositories.module';
import { SocialInsuranceController } from './social-insurance.controller';
import { SocialInsuranceService } from './social-insurance.service';

@Module({
  imports: [PayrollRepositoriesModule],
  controllers: [SocialInsuranceController],
  providers: [SocialInsuranceService],
})
export class SocialInsuranceModule {}
