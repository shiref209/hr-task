import type { Department } from '@hr/types';
import type { DepartmentRepository } from '../../src/departments/departments.repository';
import { ENGINEERING, FINANCE, HUMAN_RESOURCES } from './employee.builder';

export class InMemoryDepartmentRepository implements DepartmentRepository {
  constructor(
    private readonly rows: Department[] = [
      ENGINEERING,
      HUMAN_RESOURCES,
      FINANCE,
    ],
  ) {}

  async findAll(): Promise<Department[]> {
    return [...this.rows].sort((a, b) => a.name.localeCompare(b.name));
  }

  async exists(id: string): Promise<boolean> {
    return this.rows.some((department) => department.id === id);
  }
}
