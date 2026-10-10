import { Module } from '@nestjs/common';
import { DATABASE_HEALTH, PrismaDatabaseHealth } from './database-health';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [{ provide: DATABASE_HEALTH, useClass: PrismaDatabaseHealth }],
})
export class HealthModule {}
