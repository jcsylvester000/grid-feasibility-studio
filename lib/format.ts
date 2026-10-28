/** Display formatting only (BRD 8.1 rule 5): PHP currency, thousands separators, dates as "22 Oct 2026". */
const php0 = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export const formatPHP = (n: number) => php0.format(n);
export const formatNumber = (n: number) => int.format(n);

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-22" or a Date → "22 Oct 2026" (date-only strings are not shifted by time zone). */
export function formatDate(input: string | Date) {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number) as [number, number, number];
    return `${d} ${months[m - 1]} ${y}`;
  }
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "numeric", year: "numeric" })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${Number(parts.day)} ${months[Number(parts.month) - 1]} ${parts.year}`;
}

/** A Date → "28 Oct 2026, 2:14 PM" (Manila time). */
export function formatDateTime(date: Date) {
  const time = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true }).format(date).replace(/\s?([ap])\.?m\.?/i, (_m, a: string) => ` ${a.toUpperCase()}M`);
  return `${formatDate(date)}, ${time}`;
}
