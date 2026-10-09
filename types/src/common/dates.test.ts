import { describe, expect, it } from 'vitest';
import { todayInTimeZone } from './dates';

describe('todayInTimeZone', () => {
  const lateEveningUtc = new Date('2026-10-08T22:30:00Z');

  it('returns the next calendar day when the zone is already past midnight', () => {
    expect(todayInTimeZone('Africa/Cairo', lateEveningUtc)).toBe('2026-10-09');
  });

  it('returns the UTC calendar day for UTC', () => {
    expect(todayInTimeZone('UTC', lateEveningUtc)).toBe('2026-10-08');
  });

  it('returns the previous calendar day for a zone behind UTC', () => {
    expect(
      todayInTimeZone('America/Los_Angeles', new Date('2026-10-08T03:00:00Z')),
    ).toBe('2026-10-07');
  });

  it('formats as zero-padded YYYY-MM-DD', () => {
    expect(todayInTimeZone('UTC', new Date('2026-01-05T12:00:00Z'))).toBe(
      '2026-01-05',
    );
  });

  it('defaults to the current instant when no date is given', () => {
    expect(todayInTimeZone('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
