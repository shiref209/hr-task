import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { idParamSchema, payItemsSchema, type PayItems } from '@hr/types';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  apiBody,
  apiEnvelope,
  apiIdParam,
  apiProblems,
} from '../../docs/zod-openapi';
import { PayItemsService } from './pay-items.service';

const IdParam = () => Param(new ZodValidationPipe(idParamSchema));
type IdParam = { id: string };

@ApiTags('Pay items')
@Controller('employees/:id/pay-items')
export class PayItemsController {
  constructor(private readonly payItems: PayItemsService) {}

  @Get()
  @ApiOperation({ summary: "Get an employee's allowances and deductions" })
  @apiIdParam()
  @apiEnvelope(payItemsSchema)
  @apiProblems(400, 404)
  get(@IdParam() { id }: IdParam): Promise<PayItems> {
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
  @apiProblems(400, 404)
  replace(
    @IdParam() { id }: IdParam,
    @Body(new ZodValidationPipe(payItemsSchema)) items: PayItems,
  ): Promise<PayItems> {
    return this.payItems.replace(id, items);
  }
}
