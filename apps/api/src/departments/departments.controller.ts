import { Controller, Get } from '@nestjs/common';
import type { Department } from '@hr/types';
import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  findAll(): Promise<Department[]> {
    return this.departments.findAll();
  }
}
