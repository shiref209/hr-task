import { z } from 'zod';

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Success envelope returned by every API endpoint that has a body. */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}
