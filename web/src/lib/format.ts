/** Small formatting helpers shared across the UI. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-02-10' -> 'Feb 10' (compact, timezone-safe — no Date parsing). */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}
