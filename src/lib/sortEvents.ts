/**
 * Time-aware itinerary ordering (ODY-042).
 * Events with a startTime sort ascending ("HH:MM"); events without a start
 * time sort last, keeping their orderIndex among themselves. Ties break on
 * orderIndex so the sort is stable.
 */

export type SortableByTime = {
  startTime: string | null | undefined;
  orderIndex: number;
};

function hasStartTime(ev: SortableByTime): boolean {
  return Boolean(ev.startTime?.trim());
}

export function sortEventsByTime<T extends SortableByTime>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const aTimed = hasStartTime(a);
    const bTimed = hasStartTime(b);

    if (aTimed && bTimed) {
      const byTime = (a.startTime as string).localeCompare(b.startTime as string);
      if (byTime !== 0) return byTime;
      return a.orderIndex - b.orderIndex;
    }
    if (aTimed && !bTimed) return -1;
    if (!aTimed && bTimed) return 1;
    return a.orderIndex - b.orderIndex;
  });
}
