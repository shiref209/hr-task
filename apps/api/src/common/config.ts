import { z } from 'zod';

const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Must be a valid IANA time zone');

// Parsed at import time so an invalid environment fails the process at startup.
export const appConfig = z
  .object({
    APP_TIMEZONE: timeZone.default('Africa/Cairo'),
    UPLOADS_DIR: z.string().min(1).default('uploads'),
  })
  .parse(process.env);
