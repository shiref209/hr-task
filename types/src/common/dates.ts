/** Today's date as YYYY-MM-DD in the runtime's local time zone (the API runs with TZ set). */
export const localToday = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** The current local month as "YYYY-MM". */
export const currentMonth = (): string => localToday().slice(0, 7);
