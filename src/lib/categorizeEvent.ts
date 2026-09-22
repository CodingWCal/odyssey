import type { EventType } from "@/types";

/**
 * Auto-categorize an event's type from its title (ODY-127), e.g. "Delta
 * flight to LAX" -> flight, "Uber to the airport" -> transport, "Dinner at
 * Nobu" -> restaurant. Pure and dependency-free so it's cheap to run on
 * every keystroke; callers decide when to apply the result (only for a new
 * event, and only until the user has manually touched the type chips —
 * this never overrides an explicit or previously-saved choice).
 *
 * Checked in a fixed order so a title that could plausibly match more than
 * one group (rare, but e.g. "brunch" before a "train") resolves the same
 * way every time; returns null when nothing matches, meaning "leave the
 * type as-is."
 */
const KEYWORDS: [EventType, string[]][] = [
  ["flight", ["flight", "airlines", "airways"]],
  ["transport", ["uber", "lyft", "taxi", "train", "subway", "transit", "ferry", "rental car"]],
  ["restaurant", ["restaurant", "dinner", "lunch", "brunch", "breakfast", "cafe", "café", "bistro"]],
  ["hotel", ["hotel", "airbnb", "hostel", "check-in"]],
];

export function categorizeEvent(title: string): EventType | null {
  const t = title.toLowerCase();
  for (const [type, keywords] of KEYWORDS) {
    if (keywords.some((k) => t.includes(k))) return type;
  }
  return null;
}
