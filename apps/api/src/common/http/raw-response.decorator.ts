import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';
/** Skips the `{ data }` envelope: for routes whose plain body is read by machines (health checks). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
