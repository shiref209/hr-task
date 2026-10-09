import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { appliedTaxTableSchema, type AppliedTaxTable } from '@hr/types';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { CurrentUser } from '../../auth/current-user.decorator';
import { apiEnvelope, apiProblems } from '../../docs/zod-openapi';
import { MyTaxTableService } from './my-tax-table.service';

@ApiTags('Tax tables')
@ApiCookieAuth()
@Controller('me/tax-table')
export class MyTaxTableController {
  constructor(private readonly myTaxTable: MyTaxTableService) {}

  @Get()
  @ApiOperation({ summary: 'The tax table applied to the signed-in employee' })
  @apiEnvelope(appliedTaxTableSchema)
  @apiProblems(401, 404)
  get(@CurrentUser() user: AuthPrincipal): Promise<AppliedTaxTable> {
    return this.myTaxTable.forEmployee(user.employeeId);
  }
}
