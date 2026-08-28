import "server-only";
import { geocode, assertGeocodeAllowed } from "@/lib/geocode";
import { haversineKm } from "@/lib/geoDistance";
import { resolveVibe, buildOverpassQuery } from "@/lib/vibePresets";
import type { EventType } from "@/types";

/**
 * Real point-of-interest search for Explore (ODY-049), via the Overpass API
 * over OpenStreetMap data. Replaces the original Nominatim path, which could
 * only geocode names and so returned nothing for vibe phrases like "cozy cafés".
 * Keyless, and soft-fails to [] on network/quota trouble so the Explore UI
 * degrades to its "nothing turned up" state rather than throwing.
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
const SEARCH_RADIUS_M = 9000;
const RAW_CAP = 40;
const REQUEST_TIMEOUT_MS = 12_000;

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

// Best-effort in-memory TTL cache keyed on preset filters + rounded centre.
// Serverless instances each get their own copy — a politeness cache, not a
// correctness guarantee (same rationale as the geocode cache).
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { expires: number; data: OverpassElement[] }>();

function readCache(key: string): OverpassElement[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function writeCache(key: string, data: OverpassElement[]) {
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + TTL_MS, data });
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
      continue; // try the next mirror, then give up softly
    }
  }
  return [];
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Suggestions for a vibe near a destination, closest-to-centre first. `userKey`
 * bounds Overpass/geocode calls with the shared per-user politeness limit.
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

  const key = `${preset.filters.join("|")}@${center.lat.toFixed(3)},${center.lng.toFixed(3)}`;
  let elements = readCache(key);
  if (!elements) {
    assertGeocodeAllowed(userKey); // shared external-map politeness budget
    const query = buildOverpassQuery(preset.filters, center.lat, center.lng, SEARCH_RADIUS_M, RAW_CAP);
    elements = await fetchOverpass(query);
    writeCache(key, elements);
  }

  const seen = new Set<string>();
  const places: VibePlace[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    const name = t.name?.trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;

    const dedupe = name.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const area =
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
