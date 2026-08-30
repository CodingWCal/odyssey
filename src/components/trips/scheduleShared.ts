import type { AvailabilityBlock, AvailabilityStatus } from "@/types";

// UTC calendar-day key (YYYY-MM-DD). Must match the backend's date key logic.
export function toDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

// Inclusive list of UTC calendar dates between two dates.
export function eachDay(start: Date | string, end: Date | string): Date[] {
  const out: Date[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (current <= last) {
    out.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return out;
}

export const ALL_BLOCKS: AvailabilityBlock[] = ["all_day", "morning", "afternoon", "evening"];

export const BLOCK_LABEL: Record<AvailabilityBlock, string> = {
  all_day: "All day",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function formatDayLabel(date: Date): { weekday: string; day: string } {
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  };
}

export type FillSlot = { date: string; block: AvailabilityBlock; status: AvailabilityStatus };

/**
 * Build the {date, block, status} list for a bulk fill (ODY-109): the cartesian
 * product of the given date keys and blocks at one status. Used for the
 * "whole day", "whole block column", and "whole range" free shortcuts, so the
 * grid and any test agree on exactly which cells a bulk action touches.
 */
export function fillSlots(
  dateKeys: string[],
  blocks: AvailabilityBlock[],
  status: AvailabilityStatus,
): FillSlot[] {
  return dateKeys.flatMap((date) => blocks.map((block) => ({ date, block, status })));
}
