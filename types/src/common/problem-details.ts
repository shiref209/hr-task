import { z } from 'zod';

export const ProblemType = {
  validationError: '/problems/validation-error',
  malformedRequest: '/problems/malformed-request',
  unauthorized: '/problems/unauthorized',
  forbidden: '/problems/forbidden',
  tooManyRequests: '/problems/too-many-requests',
  notFound: '/problems/not-found',
  conflict: '/problems/conflict',
  payloadTooLarge: '/problems/payload-too-large',
  unsupportedMediaType: '/problems/unsupported-media-type',
  businessRuleViolation: '/problems/business-rule-violation',
} as const;

/** RFC 7807 error body returned by the API for every non-2xx response. */
export const errorDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Field path -> messages; validation problems only. */
  errors: z.record(z.string(), z.array(z.string())).optional(),
});
export type ProblemDetails = z.infer<typeof errorDetailsSchema>;
