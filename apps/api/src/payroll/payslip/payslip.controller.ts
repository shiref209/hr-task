import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  idParamSchema,
  payslipQuerySchema,
  payslipSchema,
  type Payslip,
  type PayslipQuery,
} from '@hr/types';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ForbiddenError } from '../../common/errors/domain-errors';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
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
    @Param(new ZodValidationPipe(idParamSchema)) { id }: { id: string },
    @Query(new ZodValidationPipe(payslipQuerySchema)) { month }: PayslipQuery,
  ): Promise<Payslip> {
    if (user.role !== 'HR' && user.employeeId !== id)
      throw new ForbiddenError('You can only view your own payslip.');
    return this.payslips.generate(id, month);
  }
}
