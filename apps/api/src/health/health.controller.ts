import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { RawResponse } from '../common/http/raw-response.decorator';
import { DATABASE_HEALTH, type DatabaseHealth } from './database-health';

const DATABASE_TIMEOUT_MS = 1000;

interface HealthBody {
  status: 'ok' | 'error';
  database: 'up' | 'down';
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_HEALTH) private readonly db: DatabaseHealth) {}

  @Public()
  @RawResponse()
  @Get()
  @ApiOperation({ summary: 'Liveness and database check' })
  @ApiResponse({ status: 200, description: '{ status: "ok", database: "up" }' })
  @ApiResponse({
    status: 503,
    description: '{ status: "error", database: "down" }',
  })
  async check(
    @Res({ passthrough: true }) res: Pick<Response, 'status'>,
  ): Promise<HealthBody> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(resolve, DATABASE_TIMEOUT_MS, false);
    });
    const up = await Promise.race([this.db.ping().then(() => true), timeout])
      .catch(() => false)
      .finally(() => clearTimeout(timer));
    if (up) return { status: 'ok', database: 'up' };
    res.status(503);
    return { status: 'error', database: 'down' };
  }
}
