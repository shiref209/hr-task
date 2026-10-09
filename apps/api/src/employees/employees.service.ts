import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListQuery,
  UpdateEmployeeInput,
} from '@hr/types';
import { CLOCK, type Clock } from '../common/clock';
import { UnsupportedMediaTypeError } from '../common/errors/domain-errors';
import { PaginatedResult } from '../common/http/paginated-result';
import {
  DEPARTMENT_REPOSITORY,
  type DepartmentRepository,
} from '../departments/departments.repository';
import {
  DepartmentNotFoundError,
  EmailAlreadyUsedError,
  EmployeeNotDeletedError,
  EmployeeNotFoundError,
  LastHrError,
} from './employees.errors';
import {
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from './employees.repository';
import { FILE_STORAGE, type FileStorage } from './profile-image/file-storage';
import { detectImageType } from './profile-image/image-type';

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

const isActiveHr = (employee: Employee) =>
  employee.type === 'HR' && employee.status === 'ACTIVE';

@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departments: DepartmentRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async create(input: CreateEmployeeInput): Promise<Employee> {
    await this.assertDepartmentExists(input.departmentId);
    await this.assertEmailAvailable(input.email);
    return this.employees.create(input);
  }

  async list(query: EmployeeListQuery): Promise<PaginatedResult<Employee>> {
    const { items, totalItems } = await this.employees.list(query);
    return new PaginatedResult(items, query.page, query.pageSize, totalItems);
  }

  getById(id: string): Promise<Employee> {
    return this.findActiveOrFail(id);
  }

  async update(id: string, changes: UpdateEmployeeInput): Promise<Employee> {
    const employee = await this.findActiveOrFail(id);
    if (changes.departmentId !== undefined)
      await this.assertDepartmentExists(changes.departmentId);
    if (changes.email !== undefined)
      await this.assertEmailAvailable(changes.email, id);
    if (changes.status === 'INACTIVE' || changes.type === 'EMPLOYEE')
      await this.assertNotLastHr(employee);
    return this.employees.update(id, changes);
  }

  async remove(id: string): Promise<void> {
    const employee = await this.findActiveOrFail(id);
    await this.assertNotLastHr(employee);
    await this.employees.update(id, { deletedAt: this.clock.now() });
  }

  async restore(id: string): Promise<Employee> {
    const employee = await this.employees.findById(id, {
      includeDeleted: true,
    });
    if (!employee) throw new EmployeeNotFoundError();
    if (employee.deletedAt === null) throw new EmployeeNotDeletedError();
    return this.employees.update(id, { deletedAt: null });
  }

  async setProfileImage(id: string, file: UploadedImage): Promise<Employee> {
    const employee = await this.findActiveOrFail(id);
    const type = detectImageType(file.buffer);
    if (!type)
      throw new UnsupportedMediaTypeError(
        'Only JPEG, PNG and WebP images are accepted.',
      );
    // ponytail: if the record update fails after save, the new file is orphaned; a cleanup job if it matters.
    const url = await this.storage.save(
      file.buffer,
      type === 'jpeg' ? 'jpg' : type,
    );
    const updated = await this.employees.update(id, { profileImageUrl: url });
    if (employee.profileImageUrl)
      await this.storage.remove(employee.profileImageUrl);
    return updated;
  }

  private async findActiveOrFail(id: string): Promise<Employee> {
    const employee = await this.employees.findById(id);
    if (!employee) throw new EmployeeNotFoundError();
    return employee;
  }

  private async assertDepartmentExists(id: string): Promise<void> {
    if (!(await this.departments.exists(id)))
      throw new DepartmentNotFoundError();
  }

  private async assertEmailAvailable(
    email: string,
    ownerId?: string,
  ): Promise<void> {
    const owner = await this.employees.findByEmail(email);
    if (owner && owner.id !== ownerId)
      throw new EmailAlreadyUsedError(owner.deletedAt !== null);
  }

  // ponytail: check-then-act race between countActiveHr and the write; a DB-level lock or serializable
  // transaction is the upgrade if concurrent HR edits matter.
  private async assertNotLastHr(employee: Employee): Promise<void> {
    if (isActiveHr(employee) && (await this.employees.countActiveHr()) <= 1)
      throw new LastHrError();
  }
}
