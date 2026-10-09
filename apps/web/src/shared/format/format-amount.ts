const formatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Intl accepts the decimal string directly, so money never passes through a JS number.
export function formatAmount(value: string): string {
  return formatter.format(value as `${number}`);
}
