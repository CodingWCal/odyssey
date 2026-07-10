/**
 * Local-calendar date helpers shared by trip creation/editing (ODY-003/016).
 * The app stores Day rows at local midnight; these keep "2026-07-10" meaning
 * July 10 regardless of timezone.
 */

/** Parse "YYYY-MM-DD" as a local date (not UTC). */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
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

/** Key a date by its local calendar day (matches how Day rows are stored). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
