import { Injectable } from '@nestjs/common';
import type { PayItemKind } from '@prisma/client';
import type { PayItem, PayItems } from '@hr/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { PayItemRepository } from './pay-items.repository';

const toRows = (employeeId: string, kind: PayItemKind, items: PayItem[]) =>
  items.map(({ name, amount }, position) => ({
    employeeId,
    kind,
    name,
    amount,
    position,
  }));

@Injectable()
export class PrismaPayItemsRepository implements PayItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmployee(employeeId: string): Promise<PayItems> {
    const rows = await this.prisma.employeePayItem.findMany({
      where: { employeeId },
      orderBy: { position: 'asc' },
      select: { kind: true, name: true, amount: true },
    });
    const ofKind = (kind: PayItemKind): PayItem[] =>
      rows
        .filter((row) => row.kind === kind)
        .map(({ name, amount }) => ({ name, amount: amount.toFixed(2) }));
    return { allowances: ofKind('ALLOWANCE'), deductions: ofKind('DEDUCTION') };
  }

  async replaceForEmployee(
    employeeId: string,
    items: PayItems,
  ): Promise<PayItems> {
    await this.prisma.$transaction([
      this.prisma.employeePayItem.deleteMany({ where: { employeeId } }),
      this.prisma.employeePayItem.createMany({
        data: [
          ...toRows(employeeId, 'ALLOWANCE', items.allowances),
          ...toRows(employeeId, 'DEDUCTION', items.deductions),
        ],
      }),
    ]);
    return this.findByEmployee(employeeId);
  }
}
