/**
 * Calendar date helpers shared by trip creation/editing (ODY-003/016/048).
 * Trip and Day rows are date-only values stored as midnight timestamps.
 * Always format them with UTC calendar components so US clients don't see
 * an off-by-one vs the day the traveler picked.
 */

/** Parse "YYYY-MM-DD" as a local date (not UTC). */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Format a stored trip/day Date for `<input type="date">` (ODY-048).
 * Uses the UTC calendar day so a UTC-midnight Jul 30 never shows as Jul 29
 * in US timezones.
 */
export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** One Date per calendar day in [start, end], normalized to local midnight. */
export function enumerateDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (current <= endDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Weekday name for a stored trip/day Date (ODY-098). Uses the UTC calendar
 * day so it always agrees with `formatDate`/`toDateInputValue` instead of
 * drifting a day behind in negative-UTC-offset timezones.
 */
export function formatWeekday(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

/** Key a date by its local calendar day (matches how Day rows are stored). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Local calendar day as YYYY-MM-DD (ODY-076).
 * Use for "is today?" against a stored trip/day UTC key from `toDateInputValue`.
 * Do not use `new Date().toISOString().slice(0, 10)` — that flips after ~8pm
 * in US timezones and mis-labels the live day's "Today" badge.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
