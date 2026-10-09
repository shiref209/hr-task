import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it.each(['/settings/tax-tables?x=1', '/my-pay'])('keeps %s', (next) => {
    expect(safeNextPath(next)).toBe(next);
  });

  it.each([null, '', 'employees', '//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)'])(
    'falls back for %s',
    (next) => {
      expect(safeNextPath(next)).toBe('/employees');
    },
  );
});
