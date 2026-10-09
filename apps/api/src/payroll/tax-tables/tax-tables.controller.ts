import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type IdParam,
  type TaxTable,
  type TaxTableInput,
  taxTableInputSchema,
  taxTableSchema,
} from '@hr/types';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { ValidIdParam } from '../../common/http/id-param';
import {
  apiBody,
  apiEnvelope,
  apiIdParam,
  apiProblems,
} from '../../docs/zod-openapi';
import { TaxTablesService } from './tax-tables.service';

@ApiTags('Tax tables')
@ApiCookieAuth()
@Roles('HR')
@Controller('tax-tables')
export class TaxTablesController {
  constructor(private readonly taxTables: TaxTablesService) {}

  @Get()
  @ApiOperation({
    summary: 'List tax tables with their brackets, default first',
  })
  @apiEnvelope(z.array(taxTableSchema))
  @apiProblems(401, 403)
  list(): Promise<TaxTable[]> {
    return this.taxTables.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a tax table' })
  @apiBody(taxTableInputSchema)
  @apiEnvelope(taxTableSchema, { status: 201 })
  @apiProblems(400, 401, 403, 409, 422)
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
  @apiProblems(400, 401, 403, 404, 409, 422)
  update(
    @ValidIdParam() { id }: IdParam,
    @Body(new ZodValidationPipe(taxTableInputSchema)) input: TaxTableInput,
  ): Promise<TaxTable> {
    return this.taxTables.update(id, input);
  }

  @Post(':id/default')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make a tax table the default' })
  @apiIdParam()
  @apiEnvelope(taxTableSchema)
  @apiProblems(400, 401, 403, 404)
  setDefault(@ValidIdParam() { id }: IdParam): Promise<TaxTable> {
    return this.taxTables.setDefault(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an unused, non-default tax table' })
  @apiIdParam()
  @ApiResponse({ status: 204, description: 'Deleted' })
  @apiProblems(400, 401, 403, 404, 409)
  delete(@ValidIdParam() { id }: IdParam): Promise<void> {
    return this.taxTables.delete(id);
  }
}
