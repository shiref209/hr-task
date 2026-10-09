import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TaxTable, TaxTableInput } from '@hr/types';
import { PrismaService } from '../../prisma/prisma.service';
import { translateUniqueViolation } from '../../prisma/translate-unique-violation';
import {
  TaxTableInUseError,
  TaxTableNameTakenError,
} from './tax-tables.errors';
import type { TaxTableRepository } from './tax-tables.repository';

const withBrackets = {
  include: {
    brackets: { orderBy: { position: 'asc' } },
    _count: { select: { employees: { where: { deletedAt: null } } } },
  },
} satisfies Prisma.TaxTableDefaultArgs;

type TaxTableRow = Prisma.TaxTableGetPayload<typeof withBrackets>;

const toTaxTable = (row: TaxTableRow, unassigned = 0): TaxTable => ({
  id: row.id,
  name: row.name,
  isDefault: row.isDefault,
  brackets: row.brackets.map((bracket) => ({
    upTo: bracket.upTo?.toFixed(2) ?? null,
    rate: bracket.rate.toFixed(2),
  })),
  // Employees without a table use the default, so they count towards it.
  employeeCount: row._count.employees + (row.isDefault ? unassigned : 0),
});

const toBracketRows = (brackets: TaxTableInput['brackets']) =>
  brackets.map(({ upTo, rate }, position) => ({ position, upTo, rate }));

@Injectable()
export class PrismaTaxTablesRepository implements TaxTableRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TaxTable[]> {
    const [rows, unassigned] = await Promise.all([
      this.prisma.taxTable.findMany({
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        ...withBrackets,
      }),
      this.countUnassignedEmployees(),
    ]);
    return rows.map((row) => toTaxTable(row, unassigned));
  }

  async findById(id: string): Promise<TaxTable | null> {
    const row = await this.prisma.taxTable.findUnique({
      where: { id },
      ...withBrackets,
    });
    return row && this.withUnassigned(row);
  }

  async findDefault(): Promise<TaxTable | null> {
    const row = await this.prisma.taxTable.findFirst({
      where: { isDefault: true },
      ...withBrackets,
    });
    return row && this.withUnassigned(row);
  }

  async findByName(name: string): Promise<TaxTable | null> {
    const row = await this.prisma.taxTable.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      ...withBrackets,
    });
    return row && this.withUnassigned(row);
  }

  create({ name, brackets }: TaxTableInput): Promise<TaxTable> {
    return translateUniqueViolation(
      async () =>
        toTaxTable(
          await this.prisma.taxTable.create({
            data: { name, brackets: { create: toBracketRows(brackets) } },
            ...withBrackets,
          }),
        ),
      () => new TaxTableNameTakenError(),
    );
  }

  update(id: string, { name, brackets }: TaxTableInput): Promise<TaxTable> {
    return translateUniqueViolation(
      async () => {
        const [, row] = await this.prisma.$transaction([
          this.prisma.taxBracket.deleteMany({ where: { taxTableId: id } }),
          this.prisma.taxTable.update({
            where: { id },
            data: { name, brackets: { create: toBracketRows(brackets) } },
            ...withBrackets,
          }),
        ]);
        return this.withUnassigned(row);
      },
      () => new TaxTableNameTakenError(),
    );
  }

  async setDefault(id: string): Promise<void> {
    // Old default first: the partial unique index allows only one default at any moment.
    await this.prisma.$transaction([
      this.prisma.taxTable.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.taxTable.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
  }

  async delete(id: string): Promise<void> {
    try {
      // Soft-deleted employees don't block deletion; release them so the foreign key allows it.
      await this.prisma.$transaction([
        this.prisma.employee.updateMany({
          where: { taxTableId: id, deletedAt: { not: null } },
          data: { taxTableId: null },
        }),
        this.prisma.taxTable.delete({ where: { id } }),
      ]);
    } catch (error) {
      // An employee was assigned the table after the service's check.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      )
        throw new TaxTableInUseError();
      throw error;
    }
  }

  countAssignedEmployees(id: string): Promise<number> {
    return this.prisma.employee.count({
      where: { taxTableId: id, deletedAt: null },
    });
  }

  async highestRate(): Promise<string | null> {
    const { _max } = await this.prisma.taxBracket.aggregate({
      _max: { rate: true },
    });
    return _max.rate?.toFixed(2) ?? null;
  }

  private async withUnassigned(row: TaxTableRow): Promise<TaxTable> {
    return toTaxTable(
      row,
      row.isDefault ? await this.countUnassignedEmployees() : 0,
    );
  }

  private countUnassignedEmployees(): Promise<number> {
    return this.prisma.employee.count({
      where: { taxTableId: null, deletedAt: null },
    });
  }
}
