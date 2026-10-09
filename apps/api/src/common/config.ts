import { z } from 'zod';

// Parsed at import time so an invalid environment fails the process at startup.
export const appConfig = z
  .object({
    UPLOADS_DIR: z.string().min(1).default('uploads'),
    SWAGGER_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .parse(process.env);
