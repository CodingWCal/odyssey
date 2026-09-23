import { daysBetweenUTC } from "@/lib/dates";

/**
 * Multi-night lodging (hotel type only): a check-out date set to *after*
 * the event's own day turns it from a normal same-day timed event into an
 * all-day banner spanning every day of the stay. Same-day/no checkout is
 * the ordinary case and behaves exactly like any other event.
 */
export function isMultiNightLodging(
  type: string,
  checkInDate: Date | string,
  checkOutDate: Date | string | null | undefined
): boolean {
  if (type !== "hotel" || !checkOutDate) return false;
  return daysBetweenUTC(new Date(checkInDate), new Date(checkOutDate)) > 0;
}

export type LodgingPhase = "check-in" | "staying" | "check-out";

/**
 * Which phase (if any) a multi-night stay is in on a given day — null if
 * the day falls outside [checkInDate, checkOutDate]. Caller is expected to
 * have already confirmed this is a multi-night stay via isMultiNightLodging.
 */
export function lodgingPhaseForDay(
  checkInDate: Date | string,
  checkOutDate: Date | string,
  day: Date | string
): LodgingPhase | null {
  const inDate = new Date(checkInDate);
  const outDate = new Date(checkOutDate);
  const d = new Date(day);
  if (daysBetweenUTC(inDate, d) < 0 || daysBetweenUTC(d, outDate) < 0) return null;
  if (daysBetweenUTC(inDate, d) === 0) return "check-in";
  if (daysBetweenUTC(d, outDate) === 0) return "check-out";
  return "staying";
}
