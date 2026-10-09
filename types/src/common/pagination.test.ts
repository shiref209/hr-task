import { describe, expect, it } from 'vitest';
import { paginationQuerySchema } from './pagination';

describe('paginationQuerySchema', () => {
  it('defaults to page 1 and pageSize 20 for an empty query', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('coerces numeric strings from the query string', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('rejects page 0', () => {
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('accepts page 1', () => {
    expect(paginationQuerySchema.parse({ page: 1 }).page).toBe(1);
  });

  it('rejects pageSize 0', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 0 }).success).toBe(
      false,
    );
  });

  it('accepts pageSize 1', () => {
    expect(paginationQuerySchema.parse({ pageSize: 1 }).pageSize).toBe(1);
  });

  it('accepts pageSize 100', () => {
    expect(paginationQuerySchema.parse({ pageSize: 100 }).pageSize).toBe(100);
  });

  it('rejects pageSize 101', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 101 }).success).toBe(
      false,
    );
  });

  it('rejects negative page', () => {
    expect(paginationQuerySchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it('rejects a non-integer page', () => {
    expect(paginationQuerySchema.safeParse({ page: '1.5' }).success).toBe(
      false,
    );
  });

  it('rejects a non-integer pageSize', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 2.5 }).success).toBe(
      false,
    );
  });

  it('rejects a non-numeric page', () => {
    expect(paginationQuerySchema.safeParse({ page: 'abc' }).success).toBe(
      false,
    );
  });

  it('rejects a non-numeric pageSize', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 'abc' }).success).toBe(
      false,
    );
  });
});
