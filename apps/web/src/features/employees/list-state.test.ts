import { describe, expect, it } from 'vitest';
import {
  parseListState,
  toListQuery,
  toSearchParams,
  type EmployeeListState,
} from './list-state';

const UUID = '11111111-1111-4111-8111-111111111111';
const defaults: EmployeeListState = { search: '', deleted: false, page: 1 };
const full: EmployeeListState = {
  search: 'ann',
  departmentId: UUID,
  status: 'INACTIVE',
  deleted: true,
  page: 3,
};

describe('parseListState', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parseListState(new URLSearchParams(''))).toEqual(defaults);
  });

  it('round-trips a full state through toSearchParams', () => {
    expect(parseListState(toSearchParams(full))).toEqual(full);
  });

  it.each(['0', '-2', 'abc', '1.5', ''])('falls back to page 1 for page=%j', (page) => {
    expect(parseListState(new URLSearchParams({ page })).page).toBe(1);
  });

  it('falls back to no status for an unknown status', () => {
    expect(parseListState(new URLSearchParams({ status: 'FIRED' })).status).toBeUndefined();
  });

  it('falls back to no department for a non-uuid departmentId', () => {
    expect(
      parseListState(new URLSearchParams({ departmentId: 'nope' })).departmentId,
    ).toBeUndefined();
  });

  it('treats anything but deleted=true as not deleted', () => {
    expect(parseListState(new URLSearchParams({ deleted: 'yes' })).deleted).toBe(false);
  });
});

describe('toSearchParams', () => {
  it('omits every default so the default view has a clean URL', () => {
    expect(toSearchParams(defaults).toString()).toBe('');
  });

  it('omits page 1 but keeps other set values', () => {
    const params = toSearchParams({ ...full, page: 1 });
    expect(params.has('page')).toBe(false);
    expect(params.get('search')).toBe('ann');
    expect(params.get('departmentId')).toBe(UUID);
    expect(params.get('status')).toBe('INACTIVE');
    expect(params.get('deleted')).toBe('true');
  });

  it('writes the page when it is not 1', () => {
    expect(toSearchParams({ ...defaults, page: 2 }).get('page')).toBe('2');
  });
});

describe('toListQuery', () => {
  it('uses page size 20 and sends no optional params by default', () => {
    expect(toListQuery(defaults, '')).toEqual({ page: 1, pageSize: 20, deleted: false });
  });

  it('uses the debounced search, not the live one, trimmed', () => {
    const query = toListQuery({ ...defaults, search: 'live value' }, '  ann  ');
    expect(query.search).toBe('ann');
  });

  it('sends no search param when the debounced search is blank', () => {
    expect(toListQuery({ ...defaults, search: 'x' }, '   ').search).toBeUndefined();
  });

  it('passes the filters, deleted flag and page through', () => {
    expect(toListQuery(full, 'ann')).toEqual({
      search: 'ann',
      departmentId: UUID,
      status: 'INACTIVE',
      deleted: true,
      page: 3,
      pageSize: 20,
    });
  });
});
