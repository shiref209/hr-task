/** RFC 7807 error body returned by the API for every non-2xx response. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
