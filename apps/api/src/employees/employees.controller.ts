import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  buildCreateEmployeeSchema,
  buildUpdateEmployeeSchema,
  employeeListQuerySchema,
  employeeSchema,
  idParamSchema,
  type CreateEmployeeInput,
  type Employee,
  type EmployeeListQuery,
  type UpdateEmployeeInput,
} from '@hr/types';
import {
  apiBody,
  apiEnvelope,
  apiIdParam,
  apiProblems,
  apiQuery,
} from '../docs/zod-openapi';
import { ValidationError } from '../common/errors/domain-errors';
import { PaginatedResult } from '../common/http/paginated-result';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { CreateEmployeePipe, UpdateEmployeePipe } from './employee-input.pipes';
import { EmployeesService, type UploadedImage } from './employees.service';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// "today" only feeds a refinement that JSON Schema cannot express, so any date documents the same shape.
const DOCS_TODAY = '2000-01-01';
const createBody = buildCreateEmployeeSchema({ today: DOCS_TODAY });
const updateBody = buildUpdateEmployeeSchema({ today: DOCS_TODAY });

const IdParam = () => Param(new ZodValidationPipe(idParamSchema));
type IdParam = { id: string };

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an employee' })
  @apiBody(createBody)
  @apiEnvelope(employeeSchema, { status: 201 })
  @apiProblems(400, 409)
  create(
    @Body(CreateEmployeePipe) input: CreateEmployeeInput,
  ): Promise<Employee> {
    return this.employees.create(input);
  }

  @Get()
  @ApiOperation({
    summary: 'List employees, paginated, with search and filters',
  })
  @apiQuery(employeeListQuerySchema)
  @apiEnvelope(employeeSchema, { paginated: true })
  @apiProblems(400)
  list(
    @Query(new ZodValidationPipe(employeeListQuerySchema))
    query: EmployeeListQuery,
  ): Promise<PaginatedResult<Employee>> {
    return this.employees.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by id' })
  @apiIdParam()
  @apiEnvelope(employeeSchema)
  @apiProblems(400, 404)
  getById(@IdParam() { id }: IdParam): Promise<Employee> {
    return this.employees.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an employee (partial)' })
  @apiIdParam()
  @apiBody(updateBody)
  @apiEnvelope(employeeSchema)
  @apiProblems(400, 404, 409, 422)
  update(
    @IdParam() { id }: IdParam,
    @Body(UpdateEmployeePipe) changes: UpdateEmployeeInput,
  ): Promise<Employee> {
    return this.employees.update(id, changes);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an employee' })
  @apiIdParam()
  @ApiResponse({ status: 204, description: 'Deleted' })
  @apiProblems(400, 404, 422)
  remove(@IdParam() { id }: IdParam): Promise<void> {
    return this.employees.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore a soft-deleted employee' })
  @apiIdParam()
  @apiEnvelope(employeeSchema)
  @apiProblems(400, 404, 409)
  restore(@IdParam() { id }: IdParam): Promise<Employee> {
    return this.employees.restore(id);
  }

  @Post(':id/profile-image')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  @ApiOperation({
    summary: 'Upload a profile image',
    description: 'JPEG, PNG or WebP, at most 2 MB.',
  })
  @apiIdParam()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG or WebP image, at most 2 MB',
        },
      },
    },
  })
  @apiEnvelope(employeeSchema)
  @apiProblems(400, 404, 413, 415)
  uploadProfileImage(
    @IdParam() { id }: IdParam,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<Employee> {
    if (!file) throw new ValidationError({ file: ['File is required'] });
    return this.employees.setProfileImage(id, file);
  }
}
