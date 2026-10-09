export const ProblemType = {
  validationError: '/problems/validation-error',
  malformedRequest: '/problems/malformed-request',
  notFound: '/problems/not-found',
  conflict: '/problems/conflict',
  payloadTooLarge: '/problems/payload-too-large',
  unsupportedMediaType: '/problems/unsupported-media-type',
  businessRuleViolation: '/problems/business-rule-violation',
} as const;

/** RFC 7807 error body returned by the API for every non-2xx response. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Field path -> messages; validation problems only. */
  errors?: Record<string, string[]>;
}
