import "server-only";
import { unstable_cache } from "next/cache";
import { geocode } from "@/lib/geocode";
import { haversineKm } from "@/lib/geoDistance";
import { resolveVibe, buildOverpassQuery } from "@/lib/vibePresets";
import type { EventType } from "@/types";

/**
 * Real point-of-interest search for Explore (ODY-049), via the Overpass API
 * over OpenStreetMap data. Replaces the original Nominatim path, which could
 * only geocode names and so returned nothing for vibe phrases like "cozy cafés".
 * Keyless. Results are cached persistently (Next Data Cache) so a given
 * category + location hits the public Overpass servers at most once per TTL —
 * important because those servers rate-limit per IP and Vercel's are shared. A
 * moment where every mirror is busy throws OverpassUnavailableError (uncached)
 * so the UI can invite a retry instead of claiming nothing matched.
 */

export interface VibePlace {
  title: string;
  location: string;
  category: EventType;
  blurb: string;
  lat: number;
  lng: number;
}

const USER_AGENT = "Odyssey-TripPlanner/1.0 (collaborative itinerary app)";
// 6 km keeps dense categories (cafés, restaurants near a city centre) light
// enough that Overpass answers within its timeout, while still covering the
// walkable core of a destination.
const SEARCH_RADIUS_M = 6000;
const RAW_CAP = 40;
const REQUEST_TIMEOUT_MS = 12_000;
// POIs change slowly, so a fetched category+location stays cached for a month.
const POI_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Every Overpass mirror refused or timed out — distinct from an empty result
 *  so the UI can invite a retry instead of claiming nothing matched. */
export class OverpassUnavailableError extends Error {
  constructor() {
    super("Explore search is busy right now — try again in a moment.");
    this.name = "OverpassUnavailableError";
  }
}

// Public Overpass instances, tried in order — any one can be busy or briefly
// refuse a request, so we fail over across a few community mirrors.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Explicitly accept JSON: overpass-api.de front-ends with Apache
          // content-negotiation and answers 406 "Not Acceptable" when the
          // caller does not clearly ask for a representation it can serve.
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return Array.isArray(json.elements) ? json.elements : [];
    } catch {
      continue; // try the next mirror
    }
  }
  // No mirror served the request. Throw (rather than return []) so the failure
  // isn't cached and the UI can invite a retry, distinct from a genuine miss.
  throw new OverpassUnavailableError();
}

/**
 * Overpass POIs for a filter set near a point, wrapped in Next's persistent
 * Data Cache keyed on the rounded centre, so a category+location is fetched at
 * most once per TTL across all invocations. Failures propagate uncached.
 */
function fetchPois(filters: string[], lat: number, lng: number): Promise<OverpassElement[]> {
  const roundedLat = Number(lat.toFixed(3));
  const roundedLng = Number(lng.toFixed(3));
  return unstable_cache(
    () => fetchOverpass(buildOverpassQuery(filters, roundedLat, roundedLng, SEARCH_RADIUS_M, RAW_CAP)),
    ["explore-pois", filters.join("|"), String(roundedLat), String(roundedLng), String(SEARCH_RADIUS_M)],
    { revalidate: POI_TTL_SECONDS }
  )();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Suggestions for a vibe near a destination, closest-to-centre first. Throws
 * OverpassUnavailableError when the POI servers are all busy.
 */
export async function searchPlacesByVibe(
  vibe: string,
  destination: string,
  userKey: string,
  limit = 8
): Promise<VibePlace[]> {
  const preset = resolveVibe(vibe);

  // Anchor on the destination's coordinates (one geocode — cached and
  // rate-limited by the shared helper).
  const center = await geocode(destination, { userKey });
  if (!center) return [];

  const elements = await fetchPois(preset.filters, center.lat, center.lng);

  const seen = new Set<string>();
  const places: VibePlace[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    // Prefer the English name when OSM has one (name:en); fall back to the
    // local-language name only when it doesn't.
    const name = (t["name:en"] ?? t.name)?.trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;

    const dedupe = name.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const area =
      t["addr:suburb:en"] || t["addr:neighbourhood:en"] || t["addr:city:en"] ||
      t["addr:suburb"] || t["addr:neighbourhood"] || t["addr:city"] || t["addr:town"] || destination;
    const cuisine = t.cuisine?.split(";")[0]?.replace(/_/g, " ");
    const blurb = cuisine ? `${cap(cuisine)} · near ${area}` : `${cap(preset.label)} near ${area}`;

    places.push({ title: name, location: area, category: preset.category, blurb, lat, lng });
  }

  // Closest to the destination centre first, so results feel central not random.
  return places
    .map((p) => ({ p, d: haversineKm(center, { lat: p.lat, lng: p.lng }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}
