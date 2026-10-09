import type { PaginationMeta } from '@hr/types';

export class PaginatedResult<T> {
  readonly meta: PaginationMeta;

  constructor(
    readonly items: T[],
    page: number,
    pageSize: number,
    totalItems: number,
  ) {
    this.meta = {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }
}
