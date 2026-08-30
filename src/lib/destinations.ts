/**
 * A trip's `destination` is one free-text field, but travelers write
 * multi-city trips into it ("Lisbon and Crete"). These helpers split that
 * string so Explore can anchor its search on a real place instead of failing
 * to geocode the whole compound phrase.
 */

function dedupe(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Distinct destinations for the Explore filter. Splits only on strong
 * multi-destination separators (and, &, /, +, ;) so a country-qualified single
 * destination like "Lisbon, Portugal" stays intact. Returns the whole trimmed
 * string as a single entry when there's no separator.
 */
export function splitDestinations(raw: string): string[] {
  const parts = dedupe(raw.split(/\s+and\s+|\s*[&/+;]\s*/i));
  return parts.length > 0 ? parts : [raw.trim()];
}

/**
 * Ordered geocode candidates for a destination: the full string first, then
 * each segment — splitting more aggressively (commas too) purely as a fallback
 * for when the full string won't resolve. A normal "City, Country" geocodes on
 * the first candidate and never reaches the comma split.
 */
export function geocodeCandidates(raw: string): string[] {
  const segments = raw.split(/\s+and\s+|\s*[&/+;,]\s*/i);
  return dedupe([raw, ...segments]);
}
