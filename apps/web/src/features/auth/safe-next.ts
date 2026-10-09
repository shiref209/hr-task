const DEFAULT_PATH = '/employees';

/** Only same-origin relative paths: "/x" yes; "//host", "/\host", "https://…" and "x" no. */
export function safeNextPath(next: string | null): string {
  return next !== null && /^\/(?![/\\])/.test(next) ? next : DEFAULT_PATH;
}
