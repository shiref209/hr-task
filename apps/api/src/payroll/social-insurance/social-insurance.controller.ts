import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { socialInsuranceSchema, type SocialInsurance } from '@hr/types';
import { Roles } from '../../auth/roles.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { apiBody, apiEnvelope, apiProblems } from '../../docs/zod-openapi';
import { SocialInsuranceService } from './social-insurance.service';

@ApiTags('Payroll settings')
@ApiCookieAuth()
@Roles('HR')
@Controller('payroll-settings/social-insurance')
export class SocialInsuranceController {
  constructor(private readonly socialInsurance: SocialInsuranceService) {}

  @Get()
  @ApiOperation({ summary: 'Get the social insurance rate and cap' })
  @apiEnvelope(socialInsuranceSchema)
  @apiProblems(401, 403)
  get(): Promise<SocialInsurance> {
    return this.socialInsurance.get();
  }

  @Put()
  @ApiOperation({ summary: 'Replace the social insurance rate and cap' })
  @apiBody(socialInsuranceSchema)
  @apiEnvelope(socialInsuranceSchema)
  @apiProblems(400, 401, 403, 422)
  update(
    @Body(new ZodValidationPipe(socialInsuranceSchema))
    settings: SocialInsurance,
  ): Promise<SocialInsurance> {
    return this.socialInsurance.update(settings);
  }
}
