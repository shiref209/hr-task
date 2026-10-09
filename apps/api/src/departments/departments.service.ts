import { Inject, Injectable } from '@nestjs/common';
import type { Department } from '@hr/types';
import {
  DEPARTMENT_REPOSITORY,
  type DepartmentRepository,
} from './departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departments: DepartmentRepository,
  ) {}

  findAll(): Promise<Department[]> {
    return this.departments.findAll();
  }
}
