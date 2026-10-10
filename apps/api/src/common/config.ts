import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters (openssl rand -base64 48)')
      // A copied .env.example must not boot with a publicly known secret.
      .refine((value) => !value.startsWith('replace-with'), 'must be changed'),
    // Origin allowed by CORS (the web dev server)
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    UPLOADS_DIR: z.string().min(1).default('uploads'),
    SWAGGER_ENABLED: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
    LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(20),
    LOGIN_RATE_LIMIT_PER_EMAIL: z.coerce.number().int().positive().default(30),
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type AppConfig = z.infer<typeof envSchema>;

// Parsed at import time so an invalid environment fails the process at startup.
export const appConfig = envSchema.parse(process.env);
