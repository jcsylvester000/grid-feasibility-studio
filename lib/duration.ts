/** "about 5 min", "about 3 h", "45 s". */
export function formatDuration(ms: number, approx = true) {
  const s = Math.round(ms / 1000);
  const prefix = approx ? "about " : "";
  if (s < 60) return `${prefix}${s} s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${prefix}${m} min`;
  const h = Math.round((m / 60) * 10) / 10;
  return `${prefix}${h % 1 === 0 ? h.toFixed(0) : h} h`;
}

/** "3 min 05 s" for elapsed timers. */
export function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min ${sec} s`;
}

export function formatRelative(date: Date, now = new Date()) {
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d ago`;
  return new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" }).format(date);
}
