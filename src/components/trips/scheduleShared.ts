import type { AvailabilityBlock } from "@/types";

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
