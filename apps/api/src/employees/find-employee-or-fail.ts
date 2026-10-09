import type { Employee } from '@hr/types';
import { EmployeeNotFoundError } from './employees.errors';
import type { EmployeeRepository } from './employees.repository';

/** Soft-deleted employees count as not found. */
export async function findEmployeeOrFail(
  employees: EmployeeRepository,
  id: string,
): Promise<Employee> {
  const employee = await employees.findById(id);
  if (!employee) throw new EmployeeNotFoundError();
  return employee;
}
