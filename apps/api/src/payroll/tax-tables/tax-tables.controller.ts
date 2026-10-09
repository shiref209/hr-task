import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  idParamSchema,
  taxTableInputSchema,
  taxTableSchema,
  type TaxTable,
  type TaxTableInput,
} from '@hr/types';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  apiBody,
  apiEnvelope,
  apiIdParam,
  apiProblems,
} from '../../docs/zod-openapi';
import { TaxTablesService } from './tax-tables.service';

const IdParam = () => Param(new ZodValidationPipe(idParamSchema));
type IdParam = { id: string };

@ApiTags('Tax tables')
@Controller('tax-tables')
export class TaxTablesController {
  constructor(private readonly taxTables: TaxTablesService) {}

  @Get()
  @ApiOperation({
    summary: 'List tax tables with their brackets, default first',
  })
  @apiEnvelope(z.array(taxTableSchema))
  list(): Promise<TaxTable[]> {
    return this.taxTables.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a tax table' })
  @apiBody(taxTableInputSchema)
  @apiEnvelope(taxTableSchema, { status: 201 })
  @apiProblems(400, 409, 422)
  create(
    @Body(new ZodValidationPipe(taxTableInputSchema)) input: TaxTableInput,
  ): Promise<TaxTable> {
    return this.taxTables.create(input);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a tax table name and brackets' })
  @apiIdParam()
  @apiBody(taxTableInputSchema)
  @apiEnvelope(taxTableSchema)
  @apiProblems(400, 404, 409, 422)
  update(
    @IdParam() { id }: IdParam,
    @Body(new ZodValidationPipe(taxTableInputSchema)) input: TaxTableInput,
  ): Promise<TaxTable> {
    return this.taxTables.update(id, input);
  }

  @Post(':id/default')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make a tax table the default' })
  @apiIdParam()
  @apiEnvelope(taxTableSchema)
  @apiProblems(400, 404)
  setDefault(@IdParam() { id }: IdParam): Promise<TaxTable> {
    return this.taxTables.setDefault(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an unused, non-default tax table' })
  @apiIdParam()
  @ApiResponse({ status: 204, description: 'Deleted' })
  @apiProblems(400, 404, 409)
  delete(@IdParam() { id }: IdParam): Promise<void> {
    return this.taxTables.delete(id);
  }
}
