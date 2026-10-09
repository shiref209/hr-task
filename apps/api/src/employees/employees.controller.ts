import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type CreateEmployeeInput,
  createEmployeeSchema,
  type Employee,
  type EmployeeListQuery,
  employeeListQuerySchema,
  employeeSchema,
  type EmployeeSummary,
  type IdParam,
  toEmployeeSummary,
  type UpdateEmployeeInput,
  updateEmployeeSchema,
} from '@hr/types';
import { ValidIdParam } from '../common/http/id-param';
import {
  apiBody,
  apiEnvelope,
  apiIdParam,
  apiProblems,
  apiQuery,
} from '../docs/zod-openapi';
import type { AuthPrincipal } from '../auth/auth-principal';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import {
  ForbiddenError,
  ValidationError,
} from '../common/errors/domain-errors';
import { PaginatedResult } from '../common/http/paginated-result';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { EmployeesService, type UploadedImage } from './employees.service';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Salary and tax table never leave the server for a non-HR user.
const forRole = (user: AuthPrincipal, employee: Employee) =>
  user.role === 'HR' ? employee : toEmployeeSummary(employee);

@ApiTags('Employees')
@ApiCookieAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @Roles('HR')
  @ApiOperation({ summary: 'Create an employee' })
  @apiBody(createEmployeeSchema)
  @apiEnvelope(employeeSchema, { status: 201 })
  @apiProblems(400, 401, 403, 409)
  create(
    @Body(new ZodValidationPipe(createEmployeeSchema))
    input: CreateEmployeeInput,
  ): Promise<Employee> {
    return this.employees.create(input);
  }

  @Get()
  @ApiOperation({
    summary: 'List employees, paginated, with search and filters',
  })
  @apiQuery(employeeListQuerySchema)
  @apiEnvelope(employeeSchema, { paginated: true })
  @apiProblems(400, 401, 403)
  async list(
    @CurrentUser() user: AuthPrincipal,
    @Query(new ZodValidationPipe(employeeListQuerySchema))
    query: EmployeeListQuery,
  ): Promise<PaginatedResult<Employee | EmployeeSummary>> {
    if (query.deleted && user.role !== 'HR')
      throw new ForbiddenError('Only HR can list deleted employees.');
    const page = await this.employees.list(query);
    return page.map((employee) => forRole(user, employee));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by id' })
  @apiIdParam()
  @apiEnvelope(employeeSchema)
  @apiProblems(400, 401, 404)
  async getById(
    @CurrentUser() user: AuthPrincipal,
    @ValidIdParam() { id }: IdParam,
  ): Promise<Employee | EmployeeSummary> {
    return forRole(user, await this.employees.getById(id));
  }

  @Patch(':id')
  @Roles('HR')
  @ApiOperation({ summary: 'Update an employee (partial)' })
  @apiIdParam()
  @apiBody(updateEmployeeSchema)
  @apiEnvelope(employeeSchema)
  @apiProblems(400, 401, 403, 404, 409, 422)
  update(
    @ValidIdParam() { id }: IdParam,
    @Body(new ZodValidationPipe(updateEmployeeSchema))
    changes: UpdateEmployeeInput,
  ): Promise<Employee> {
    return this.employees.update(id, changes);
  }

  @Delete(':id')
  @Roles('HR')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an employee' })
  @apiIdParam()
  @ApiResponse({ status: 204, description: 'Deleted' })
  @apiProblems(400, 401, 403, 404, 422)
  remove(@ValidIdParam() { id }: IdParam): Promise<void> {
    return this.employees.remove(id);
  }

  @Post(':id/restore')
  @Roles('HR')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore a soft-deleted employee' })
  @apiIdParam()
  @apiEnvelope(employeeSchema)
  @apiProblems(400, 401, 403, 404, 409)
  restore(@ValidIdParam() { id }: IdParam): Promise<Employee> {
    return this.employees.restore(id);
  }

  @Post(':id/profile-image')
  @Roles('HR')
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
  @apiProblems(400, 401, 403, 404, 413, 415)
  uploadProfileImage(
    @ValidIdParam() { id }: IdParam,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<Employee> {
    if (!file) throw new ValidationError({ file: ['File is required'] });
    return this.employees.setProfileImage(id, file);
  }
}
