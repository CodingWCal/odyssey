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

/**
 * The venue/street segment of a geocoded address (ODY-129) — the text
 * before the first comma, e.g. "123 Main St" out of "123 Main St,
 * Cambridge, MA 02139, United States". A location with no comma (already
 * short, or a plain place name) is returned unchanged — nothing to shorten.
 */
export function firstAddressSegment(location: string): string {
  const idx = location.indexOf(",");
  return idx === -1 ? location : location.slice(0, idx).trim();
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
