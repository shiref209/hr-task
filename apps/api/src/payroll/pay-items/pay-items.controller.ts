import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type IdParam, type PayItems, payItemsSchema } from '@hr/types';
import { Roles } from '../../auth/roles.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { ValidIdParam } from '../../common/http/id-param';
import {
  apiBody,
  apiEnvelope,
  apiIdParam,
  apiProblems,
} from '../../docs/zod-openapi';
import { PayItemsService } from './pay-items.service';

@ApiTags('Pay items')
@ApiCookieAuth()
@Roles('HR')
@Controller('employees/:id/pay-items')
export class PayItemsController {
  constructor(private readonly payItems: PayItemsService) {}

  @Get()
  @ApiOperation({ summary: "Get an employee's allowances and deductions" })
  @apiIdParam()
  @apiEnvelope(payItemsSchema)
  @apiProblems(400, 401, 403, 404)
  get(@ValidIdParam() { id }: IdParam): Promise<PayItems> {
    return this.payItems.get(id);
  }

  @Put()
  @ApiOperation({
    summary: "Replace an employee's allowances and deductions",
    description: 'Both lists are replaced; the order is kept.',
  })
  @apiIdParam()
  @apiBody(payItemsSchema)
  @apiEnvelope(payItemsSchema)
  @apiProblems(400, 401, 403, 404)
  replace(
    @ValidIdParam() { id }: IdParam,
    @Body(new ZodValidationPipe(payItemsSchema)) items: PayItems,
  ): Promise<PayItems> {
    return this.payItems.replace(id, items);
  }
}
