import type { Department } from '@hr/types';

export const DEPARTMENT_REPOSITORY = Symbol('DEPARTMENT_REPOSITORY');

export interface DepartmentRepository {
  findAll(): Promise<Department[]>;
  exists(id: string): Promise<boolean>;
}
