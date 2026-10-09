/** Calendar date (YYYY-MM-DD) of `now` as seen in `timeZone`. The en-CA locale formats dates as ISO. */
export function todayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
