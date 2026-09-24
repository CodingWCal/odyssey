/**
 * Multi-leg flight helpers (ODY-144) — pure, no I/O. A flight event can carry
 * an ordered list of legs (e.g. BOS→LAX, then LAX→HNL) instead of a single
 * from/to pair. Day-crossing (red-eyes, overnight layovers) is inferred
 * purely from clock-time comparison — no per-leg date pickers in the form —
 * using the standard heuristic: if a leg's arrival clock time is earlier
 * than its departure clock time, it lands the next calendar day; the same
 * check applies to a layover that crosses midnight between two legs. This
 * caps at +1 day per hop, which holds for every real commercial flight or
 * layover (none run 24h+).
 */

export interface FlightLeg {
  flightNumber: string | null;
  from: string;
  fromLat: number | null;
  fromLng: number | null;
  to: string;
  toLat: number | null;
  toLng: number | null;
  /** 24h "HH:MM", same storage convention as Event.startTime/endTime. */
  departTime: string;
  arriveTime: string;
  operatedBy: string | null;
}

export interface LegDayOffset {
  departDayOffset: number;
  arriveDayOffset: number;
}

function minutesOf(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Cumulative day offset (relative to the first leg's departure day) for every leg. */
export function computeLegDayOffsets(legs: FlightLeg[]): LegDayOffset[] {
  const out: LegDayOffset[] = [];
  let carry = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (i > 0 && minutesOf(leg.departTime) < minutesOf(legs[i - 1].arriveTime)) {
      carry += 1;
    }
    const departDayOffset = carry;
    if (minutesOf(leg.arriveTime) < minutesOf(leg.departTime)) carry += 1;
    out.push({ departDayOffset, arriveDayOffset: carry });
  }
  return out;
}

/** Minutes between leg i's arrival and leg i+1's departure (a layover). */
export function layoverMinutes(legs: FlightLeg[], offsets: LegDayOffset[], i: number): number {
  const arrive = offsets[i].arriveDayOffset * 1440 + minutesOf(legs[i].arriveTime);
  const depart = offsets[i + 1].departDayOffset * 1440 + minutesOf(legs[i + 1].departTime);
  return depart - arrive;
}

/** "6h 15m" / "45m" / "2h" — never "0h 0m". */
export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * A flight is "overnight" if its overall journey lands on a later calendar
 * day than it departed — true for a plain red-eye leg, and also true when an
 * otherwise same-day-looking leg follows an overnight layover (the whole
 * journey still crosses midnight even though that one leg's own clock times
 * don't). Works for a single leg or many.
 */
export function isOvernightFlight(legs: FlightLeg[]): boolean {
  if (legs.length === 0) return false;
  const offsets = computeLegDayOffsets(legs);
  return offsets[offsets.length - 1].arriveDayOffset >= 1;
}

/** Same check for a flight with no structured legs — just top-level times. */
export function isOvernightSimple(startTime: string | null | undefined, endTime: string | null | undefined): boolean {
  if (!startTime || !endTime) return false;
  return minutesOf(endTime) < minutesOf(startTime);
}
