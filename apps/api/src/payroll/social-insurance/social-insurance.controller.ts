import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { socialInsuranceSchema, type SocialInsurance } from '@hr/types';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { apiBody, apiEnvelope, apiProblems } from '../../docs/zod-openapi';
import { SocialInsuranceService } from './social-insurance.service';

@ApiTags('Payroll settings')
@Controller('payroll-settings/social-insurance')
export class SocialInsuranceController {
  constructor(private readonly socialInsurance: SocialInsuranceService) {}

  @Get()
  @ApiOperation({ summary: 'Get the social insurance rate and cap' })
  @apiEnvelope(socialInsuranceSchema)
  get(): Promise<SocialInsurance> {
    return this.socialInsurance.get();
  }

  @Put()
  @ApiOperation({ summary: 'Replace the social insurance rate and cap' })
  @apiBody(socialInsuranceSchema)
  @apiEnvelope(socialInsuranceSchema)
  @apiProblems(400, 422)
  update(
    @Body(new ZodValidationPipe(socialInsuranceSchema))
    settings: SocialInsurance,
  ): Promise<SocialInsurance> {
    return this.socialInsurance.update(settings);
  }
}
