import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { TaxTable, TaxTableInput } from '@hr/types';
import { assertRateCeiling } from '../rate-ceiling';
import {
  SOCIAL_INSURANCE_REPOSITORY,
  type SocialInsuranceRepository,
} from '../social-insurance/social-insurance.repository';
import {
  DefaultTaxTableDeletionError,
  TaxTableInUseError,
  TaxTableNameTakenError,
  TaxTableNotFoundError,
} from './tax-tables.errors';
import {
  TAX_TABLE_REPOSITORY,
  type TaxTableRepository,
} from './tax-tables.repository';

@Injectable()
export class TaxTablesService {
  constructor(
    @Inject(TAX_TABLE_REPOSITORY)
    private readonly taxTables: TaxTableRepository,
    @Inject(SOCIAL_INSURANCE_REPOSITORY)
    private readonly socialInsurance: SocialInsuranceRepository,
  ) {}

  list(): Promise<TaxTable[]> {
    return this.taxTables.findAll();
  }

  async create(input: TaxTableInput): Promise<TaxTable> {
    await this.assertNameAvailable(input.name);
    await this.assertRateCeiling(input);
    return this.taxTables.create(input);
  }

  async update(id: string, input: TaxTableInput): Promise<TaxTable> {
    await this.findOrFail(id);
    await this.assertNameAvailable(input.name, id);
    await this.assertRateCeiling(input);
    return this.taxTables.update(id, input);
  }

  async setDefault(id: string): Promise<TaxTable> {
    const table = await this.findOrFail(id);
    if (table.isDefault) return table;
    await this.taxTables.setDefault(id);
    return { ...table, isDefault: true };
  }

  async delete(id: string): Promise<void> {
    const table = await this.findOrFail(id);
    if (table.isDefault) throw new DefaultTaxTableDeletionError();
    const assigned = await this.taxTables.countAssignedEmployees(id);
    if (assigned > 0) throw new TaxTableInUseError(assigned);
    await this.taxTables.delete(id);
  }

  private async findOrFail(id: string): Promise<TaxTable> {
    const table = await this.taxTables.findById(id);
    if (!table) throw new TaxTableNotFoundError();
    return table;
  }

  private async assertNameAvailable(
    name: string,
    ownId?: string,
  ): Promise<void> {
    const owner = await this.taxTables.findByName(name);
    if (owner && owner.id !== ownId) throw new TaxTableNameTakenError();
  }

  private async assertRateCeiling({ brackets }: TaxTableInput): Promise<void> {
    const highest = Decimal.max(...brackets.map((bracket) => bracket.rate));
    const { rate } = await this.socialInsurance.get();
    assertRateCeiling(highest.toString(), rate);
  }
}
