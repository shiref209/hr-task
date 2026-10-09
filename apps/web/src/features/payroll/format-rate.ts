/** "10.50" -> "10.5", "15.00" -> "15"; integer digits are never touched. */
export function formatRate(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
}
