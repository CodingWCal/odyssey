/**
 * Soft time-overlap detection for a day's events (ODY-077).
 * Times are "HH:MM" (24h). Untimed events are ignored.
 */

export type TimedLike = {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
};

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Half-open interval [start, end). Missing end → start+60. */
function range(ev: TimedLike): { id: string; title: string; a: number; b: number } | null {
  if (!ev.startTime) return null;
  const a = toMinutes(ev.startTime);
  if (a == null) return null;
  const end = ev.endTime ? toMinutes(ev.endTime) : a + 60;
  const b = end == null || end <= a ? a + 60 : end;
  return { id: ev.id, title: ev.title, a, b };
}

/** Map of eventId → titles of events it overlaps (soft, non-blocking). */
export function findOverlaps(events: TimedLike[]): Map<string, string[]> {
  const ranges = events.map(range).filter((r): r is NonNullable<typeof r> => r != null);
  const out = new Map<string, string[]>();
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const x = ranges[i];
      const y = ranges[j];
      if (x.a < y.b && y.a < x.b) {
        if (!out.has(x.id)) out.set(x.id, []);
        if (!out.has(y.id)) out.set(y.id, []);
        out.get(x.id)!.push(y.title);
        out.get(y.id)!.push(x.title);
      }
    }
  }
  return out;
}
