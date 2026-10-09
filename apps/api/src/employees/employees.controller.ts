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
  employeeListQuerySchema,
  idParamSchema,
  type CreateEmployeeInput,
  type Employee,
  type EmployeeListQuery,
  type UpdateEmployeeInput,
} from '@hr/types';
import { ValidationError } from '../common/errors/domain-errors';
import { PaginatedResult } from '../common/http/paginated-result';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { CreateEmployeePipe, UpdateEmployeePipe } from './employee-input.pipes';
import { EmployeesService, type UploadedImage } from './employees.service';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const IdParam = () => Param(new ZodValidationPipe(idParamSchema));
type IdParam = { id: string };

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  create(
    @Body(CreateEmployeePipe) input: CreateEmployeeInput,
  ): Promise<Employee> {
    return this.employees.create(input);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(employeeListQuerySchema))
    query: EmployeeListQuery,
  ): Promise<PaginatedResult<Employee>> {
    return this.employees.list(query);
  }

  @Get(':id')
  getById(@IdParam() { id }: IdParam): Promise<Employee> {
    return this.employees.getById(id);
  }

  @Patch(':id')
  update(
    @IdParam() { id }: IdParam,
    @Body(UpdateEmployeePipe) changes: UpdateEmployeeInput,
  ): Promise<Employee> {
    return this.employees.update(id, changes);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@IdParam() { id }: IdParam): Promise<void> {
    return this.employees.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@IdParam() { id }: IdParam): Promise<Employee> {
    return this.employees.restore(id);
  }

  @Post(':id/profile-image')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  uploadProfileImage(
    @IdParam() { id }: IdParam,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<Employee> {
    if (!file) throw new ValidationError({ file: ['File is required'] });
    return this.employees.setProfileImage(id, file);
  }
}
