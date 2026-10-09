import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type IdParam,
  type Payslip,
  type PayslipQuery,
  payslipQuerySchema,
  payslipSchema,
} from '@hr/types';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ForbiddenError } from '../../common/errors/domain-errors';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { ValidIdParam } from '../../common/http/id-param';
import {
  apiEnvelope,
  apiIdParam,
  apiProblems,
  apiQuery,
} from '../../docs/zod-openapi';
import { PayslipService } from './payslip.service';

@ApiTags('Payslips')
@ApiCookieAuth()
@Controller('employees/:id/payslip')
export class PayslipController {
  constructor(private readonly payslips: PayslipService) {}

  @Get()
  @ApiOperation({
    summary: "Get an employee's payslip for a month",
    description:
      'HR can read any payslip, an EMPLOYEE only their own. Uses current settings. Months before the hire month are rejected; future months are a preview.',
  })
  @apiIdParam()
  @apiQuery(payslipQuerySchema)
  @apiEnvelope(payslipSchema)
  @apiProblems(400, 401, 403, 404, 422)
  generate(
    @CurrentUser() user: AuthPrincipal,
    @ValidIdParam() { id }: IdParam,
    @Query(new ZodValidationPipe(payslipQuerySchema)) { month }: PayslipQuery,
  ): Promise<Payslip> {
    if (user.role !== 'HR' && user.employeeId !== id)
      throw new ForbiddenError('You can only view your own payslip.');
    return this.payslips.generate(id, month);
  }
}
