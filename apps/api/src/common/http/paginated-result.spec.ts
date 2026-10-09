import { PaginatedResult } from './paginated-result';

describe('PaginatedResult', () => {
  it('exposes items as given', () => {
    expect(new PaginatedResult(['a', 'b'], 1, 2, 2).items).toEqual(['a', 'b']);
  });

  it('computes totalPages exactly when totalItems is a multiple of pageSize', () => {
    expect(new PaginatedResult([], 1, 10, 30).meta).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 30,
      totalPages: 3,
    });
  });

  it('rounds totalPages up when there is a remainder', () => {
    expect(new PaginatedResult([], 1, 10, 31).meta.totalPages).toBe(4);
  });

  it('returns totalPages 0 when totalItems is 0', () => {
    expect(new PaginatedResult([], 1, 20, 0).meta.totalPages).toBe(0);
  });

  it('keeps the requested page when it is beyond the last page', () => {
    const { meta } = new PaginatedResult([], 9, 10, 25);

    expect(meta.page).toBe(9);
    expect(meta.totalPages).toBe(3);
  });
});
