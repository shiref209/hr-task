import type { Clock } from '../../src/common/clock';

export class FixedClock implements Clock {
  constructor(
    private readonly instant: Date = new Date('2026-10-08T10:00:00.000Z'),
  ) {}

  now(): Date {
    return new Date(this.instant);
  }
}
