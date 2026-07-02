/** Small formatting helpers shared across the UI. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-02-10' -> 'Feb 10' (compact, timezone-safe — no Date parsing). */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

/**
 * Telemetry milliseconds -> seconds string, e.g. 754 -> '0.75s'. Matches are
 * sub-second, so two decimals of seconds is the honest, readable unit.
 */
export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(2)}s`;
}
