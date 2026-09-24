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

/** Minutes since local midnight, or null for a missing/unparseable time —
 * older flights can lack a time, and a blank must never read as midnight. */
function minutesOf(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** True when `later` is clock-earlier than `earlier`, i.e. midnight passed in
 * between. Unknown (either time missing) is never treated as a crossing. */
function crossesMidnight(earlier: string, later: string): boolean {
  const a = minutesOf(earlier);
  const b = minutesOf(later);
  return a != null && b != null && b < a;
}

/** Cumulative day offset (relative to the first leg's departure day) for every leg. */
export function computeLegDayOffsets(legs: FlightLeg[]): LegDayOffset[] {
  const out: LegDayOffset[] = [];
  let carry = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (i > 0 && crossesMidnight(legs[i - 1].arriveTime, leg.departTime)) carry += 1;
    const departDayOffset = carry;
    if (crossesMidnight(leg.departTime, leg.arriveTime)) carry += 1;
    out.push({ departDayOffset, arriveDayOffset: carry });
  }
  return out;
}

/** Minutes between leg i's arrival and leg i+1's departure (a layover), or
 * null when either time is missing. */
export function layoverMinutes(legs: FlightLeg[], offsets: LegDayOffset[], i: number): number | null {
  const arrive = minutesOf(legs[i].arriveTime);
  const depart = minutesOf(legs[i + 1].departTime);
  if (arrive == null || depart == null) return null;
  return offsets[i + 1].departDayOffset * 1440 + depart - (offsets[i].arriveDayOffset * 1440 + arrive);
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
  return crossesMidnight(startTime, endTime);
}

/** The flat fields every flight carries, whether or not it has structured legs. */
interface FlightFields {
  legs: FlightLeg[] | null | undefined;
  location: string | null;
  destLocation: string | null;
  startTime: string | null;
  endTime: string | null;
  lat: number | null;
  lng: number | null;
  destLat: number | null;
  destLng: number | null;
}

/**
 * The legs to render as leg cards (ODY-145) — every flight gets the card, one
 * leg or many. A flight saved through the leg form uses its stored legs; an
 * older flight with no legs yet gets a single leg built from its flat
 * from/to/time fields (display-only — nothing is written). A flight with no
 * route to draw (no departure or no arrival) returns no legs and keeps the
 * plain location line.
 */
export function flightLegsForDisplay(f: FlightFields): FlightLeg[] {
  if (f.legs && f.legs.length > 0) return f.legs;
  if (!f.location || !f.destLocation) return [];
  return [
    {
      flightNumber: null,
      from: f.location,
      fromLat: f.lat,
      fromLng: f.lng,
      to: f.destLocation,
      toLat: f.destLat,
      toLng: f.destLng,
      departTime: f.startTime ?? "",
      arriveTime: f.endTime ?? "",
      operatedBy: null,
    },
  ];
}
