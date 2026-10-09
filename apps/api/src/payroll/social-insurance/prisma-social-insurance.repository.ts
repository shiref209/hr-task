import { Injectable } from '@nestjs/common';
import type { SocialInsuranceSettings } from '@prisma/client';
import type { SocialInsurance } from '@hr/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { SocialInsuranceRepository } from './social-insurance.repository';

// The settings are one row; the migration creates it.
const SETTINGS_ID = 1;

const toSocialInsurance = (row: SocialInsuranceSettings): SocialInsurance => ({
  rate: row.rate.toFixed(2),
  cap: row.cap?.toFixed(2) ?? null,
});

@Injectable()
export class PrismaSocialInsuranceRepository implements SocialInsuranceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SocialInsurance> {
    return toSocialInsurance(
      await this.prisma.socialInsuranceSettings.findUniqueOrThrow({
        where: { id: SETTINGS_ID },
      }),
    );
  }

  async save(settings: SocialInsurance): Promise<SocialInsurance> {
    return toSocialInsurance(
      await this.prisma.socialInsuranceSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, ...settings },
        update: settings,
      }),
    );
  }
}
