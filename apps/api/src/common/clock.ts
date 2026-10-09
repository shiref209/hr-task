import { Injectable } from '@nestjs/common';
import { todayInTimeZone } from '@hr/types';
import { appConfig } from './config';

export interface Clock {
  now(): Date;
  /** Calendar date (YYYY-MM-DD) in the configured APP_TIMEZONE. */
  today(): string;
}

export const CLOCK = Symbol('CLOCK');

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(): string {
    return todayInTimeZone(appConfig.APP_TIMEZONE, this.now());
  }
}
