import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  idParamSchema,
  payslipQuerySchema,
  payslipSchema,
  type Payslip,
  type PayslipQuery,
} from '@hr/types';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  apiEnvelope,
  apiIdParam,
  apiProblems,
  apiQuery,
} from '../../docs/zod-openapi';
import { PayslipService } from './payslip.service';

@ApiTags('Payslips')
@Controller('employees/:id/payslip')
export class PayslipController {
  constructor(private readonly payslips: PayslipService) {}

  @Get()
  @ApiOperation({
    summary: "Get an employee's payslip for a month",
    description:
      'Uses current settings. Months before the hire month are rejected; future months are a preview.',
  })
  @apiIdParam()
  @apiQuery(payslipQuerySchema)
  @apiEnvelope(payslipSchema)
  @apiProblems(400, 404, 422)
  generate(
    @Param(new ZodValidationPipe(idParamSchema)) { id }: { id: string },
    @Query(new ZodValidationPipe(payslipQuerySchema)) { month }: PayslipQuery,
  ): Promise<Payslip> {
    return this.payslips.generate(id, month);
  }
}
