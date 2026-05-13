/**
 * datetime.ts — Date/time formatting utilities (UTC+8 / China Standard Time).
 *
 * Implemented without an external dayjs dependency so the admin bundle stays
 * lean. All ISO-8601 strings from the backend are treated as UTC and then
 * converted to CST (UTC+8) for display.
 */

/** Shift a UTC Date to CST (UTC+8). */
function toCST(d: Date): Date {
  return new Date(d.getTime() + 8 * 60 * 60 * 1000);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Format an ISO-8601 date-time string as "YYYY-MM-DD".
 * Returns "—" for falsy input.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const cst = toCST(new Date(iso));
  const y = cst.getUTCFullYear();
  const mo = pad(cst.getUTCMonth() + 1);
  const d = pad(cst.getUTCDate());
  return `${y}-${mo}-${d}`;
}

/**
 * Format an ISO-8601 date-time string as "YYYY-MM-DD HH:mm".
 * Returns "—" for falsy input.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const cst = toCST(new Date(iso));
  const y = cst.getUTCFullYear();
  const mo = pad(cst.getUTCMonth() + 1);
  const d = pad(cst.getUTCDate());
  const h = pad(cst.getUTCHours());
  const m = pad(cst.getUTCMinutes());
  return `${y}-${mo}-${d} ${h}:${m}`;
}

/**
 * Format a number with thousands separator and fixed decimal places.
 * e.g. formatAmount(1234567, 2) → "12,345.67"  (if input is cents, divide by 100 first)
 */
export function formatThousands(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Convert amount in cents to a formatted Yuan string with thousands separator.
 * e.g. centsToYuan(1234567) → "12,345.67"
 */
export function centsToYuan(cents: number): string {
  return formatThousands(cents / 100, 2);
}
