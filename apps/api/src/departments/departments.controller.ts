import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { departmentSchema, type Department } from '@hr/types';
import { z } from 'zod';
import { apiEnvelope, apiProblems } from '../docs/zod-openapi';
import { DepartmentsService } from './departments.service';

@ApiTags('Departments')
@ApiCookieAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all departments' })
  @apiEnvelope(z.array(departmentSchema))
  @apiProblems(401)
  findAll(): Promise<Department[]> {
    return this.departments.findAll();
  }
}
