import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // UTC: trip/day values are date-only midnights (ODY-048).
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type TimeFormat = "12h" | "24h";

/**
 * Format an "HH:MM" time string for display (ODY-041). Storage is always
 * 24-hour "HH:MM" (native <input type="time"> value); this is display-only.
 * Unparseable input is returned unchanged so odd legacy values never break UI.
 */
export function formatTime(hhmm: string, format: TimeFormat = "12h"): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = m[2];
  if (h > 23 || Number(min) > 59) return hhmm;
  if (format === "24h") return `${String(h).padStart(2, "0")}:${min}`;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${period}`;
}
