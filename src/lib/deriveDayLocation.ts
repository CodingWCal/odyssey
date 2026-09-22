/**
 * Per-day location for the itinerary's day header (ODY-124).
 *
 * `Trip.destination` is free text typed in the New Trip wizard, e.g.
 * "Lisbon, Portugal" or, for a multi-city trip, "Tokyo & Kyoto, Japan"
 * (the wizard's own destination chips combine as `${city}, ${country}`
 * and `${cityA} & ${cityB}, ${country}`). We split that into individual
 * city candidates and match the first one that shows up in this day's
 * events' `location` (a geocoded address string), so a Kyoto day can
 * read "Kyoto" instead of the trip's full "Tokyo & Kyoto, Japan".
 *
 * A single-destination trip has only one candidate, so every day just
 * shows the trip destination — matching the ticket's acceptance criteria
 * without needing any event data.
 */

function candidateCities(destination: string): string[] {
  const parts = destination.split(",");
  const withoutTrailingCountry = parts.length > 1 ? parts.slice(0, -1).join(",") : destination;
  return withoutTrailingCountry
    .split("&")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function deriveDayLocation(
  day: { events: { location: string | null }[] },
  tripDestination: string | null | undefined
): string {
  const fallback = tripDestination?.trim() ?? "";
  if (!fallback) return "";

  const candidates = candidateCities(fallback);
  if (candidates.length <= 1) return fallback;

  for (const event of day.events) {
    if (!event.location) continue;
    const loc = event.location.toLowerCase();
    const hit = candidates.find((c) => loc.includes(c.toLowerCase()));
    if (hit) return hit;
  }
  return fallback;
}
