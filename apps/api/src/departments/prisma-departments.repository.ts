import { Injectable } from '@nestjs/common';
import type { Department } from '@hr/types';
import { PrismaService } from '../prisma/prisma.service';
import type { DepartmentRepository } from './departments.repository';

@Injectable()
export class PrismaDepartmentsRepository implements DepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Department[]> {
    return this.prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.department.count({ where: { id } })) > 0;
  }
}
