const formatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDate(isoTimestamp: string): string {
  return formatter.format(new Date(isoTimestamp));
}
