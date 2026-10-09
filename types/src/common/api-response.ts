export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Success envelope returned by every API endpoint that has a body. */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}
