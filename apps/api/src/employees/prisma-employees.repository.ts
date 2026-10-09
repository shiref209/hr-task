import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListQuery,
} from '@hr/types';
import { PrismaService } from '../prisma/prisma.service';
import { translateUniqueViolation } from '../prisma/translate-unique-violation';
import { EmailAlreadyUsedError } from './employees.errors';
import type {
  EmployeeChanges,
  EmployeeRepository,
} from './employees.repository';

const withDepartment = {
  include: {
    department: { select: { id: true, name: true } },
    taxTable: { select: { id: true, name: true } },
  },
} satisfies Prisma.EmployeeDefaultArgs;

type EmployeeRow = Prisma.EmployeeGetPayload<typeof withDepartment>;

const toEmployee = (row: EmployeeRow): Employee => ({
  id: row.id,
  fullName: row.fullName,
  email: row.email,
  phone: row.phone,
  jobTitle: row.jobTitle,
  department: row.department,
  hireDate: row.hireDate.toISOString().slice(0, 10),
  baseSalary: row.baseSalary.toFixed(2),
  status: row.status,
  type: row.type,
  profileImageUrl: row.profileImageUrl,
  taxTable: row.taxTable,
  deletedAt: row.deletedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// @db.Date columns are read back as UTC midnight
const toDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

@Injectable()
export class PrismaEmployeesRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    id: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Employee | null> {
    const row = await this.prisma.employee.findFirst({
      where: { id, ...(options.includeDeleted ? {} : { deletedAt: null }) },
      ...withDepartment,
    });
    return row && toEmployee(row);
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const row = await this.prisma.employee.findUnique({
      where: { email },
      ...withDepartment,
    });
    return row && toEmployee(row);
  }

  async list(
    query: EmployeeListQuery,
  ): Promise<{ items: Employee[]; totalItems: number }> {
    const { search } = query;
    const where: Prisma.EmployeeWhereInput = {
      deletedAt: query.deleted ? { not: null } : null,
      departmentId: query.departmentId,
      status: query.status,
      type: query.type,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, totalItems] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        ...withDepartment,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items: rows.map(toEmployee), totalItems };
  }

  create(input: CreateEmployeeInput): Promise<Employee> {
    return translateUniqueViolation(
      async () =>
        toEmployee(
          await this.prisma.employee.create({
            data: { ...input, hireDate: toDate(input.hireDate) },
            ...withDepartment,
          }),
        ),
      () => new EmailAlreadyUsedError(false),
    );
  }

  update(id: string, changes: EmployeeChanges): Promise<Employee> {
    const { hireDate, ...rest } = changes;
    return translateUniqueViolation(
      async () =>
        toEmployee(
          await this.prisma.employee.update({
            where: { id },
            data: { ...rest, hireDate: hireDate && toDate(hireDate) },
            ...withDepartment,
          }),
        ),
      () => new EmailAlreadyUsedError(false),
    );
  }

  countActiveHr(): Promise<number> {
    return this.prisma.employee.count({
      where: { type: 'HR', status: 'ACTIVE', deletedAt: null },
    });
  }
}
