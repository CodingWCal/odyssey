import "server-only";
import { unstable_cache } from "next/cache";
import { geocode } from "@/lib/geocode";
import { haversineKm } from "@/lib/geoDistance";
import { resolveVibe, buildOverpassQuery, type VibePreset } from "@/lib/vibePresets";
import type { EventType } from "@/types";

/**
 * Real point-of-interest search for Explore (ODY-049).
 *
 * Primary provider is the Foursquare Places API (keyed, via FOURSQUARE_API_KEY):
 * a curated global POI dataset built for exactly this kind of vibe discovery, so
 * "cozy cafés" / "sunset views" return real, well-named, popular places every
 * time — no per-IP rate limiting, no first-fetch retries.
 *
 * When no key is configured (local dev, or before the env var is set) or a
 * Foursquare request fails, we fall back to the keyless Overpass API over
 * OpenStreetMap so Explore still works. Both paths' results are cached in Next's
 * persistent Data Cache, keyed on the rounded centre, so a given category +
 * location is fetched at most once per TTL (this keeps us comfortably inside
 * Foursquare's free monthly call allotment). A moment where the provider is
 * entirely unavailable throws ExploreUnavailableError (uncached) so the UI can
 * invite a retry instead of claiming nothing matched.
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
// 6 km covers the walkable core of a destination while keeping dense categories
// (cafés, restaurants near a city centre) light enough to answer quickly.
const SEARCH_RADIUS_M = 6000;
const RAW_CAP = 40;
const REQUEST_TIMEOUT_MS = 12_000;
// POIs change slowly, so a fetched category+location stays cached for a month.
const POI_TTL_SECONDS = 60 * 60 * 24 * 30;

/** The POI provider was reachable-but-busy or errored — distinct from an empty
 *  result, so the UI can invite a retry instead of claiming nothing matched. */
export class ExploreUnavailableError extends Error {
  constructor() {
    super("Explore search is busy right now — try again in a moment.");
    this.name = "ExploreUnavailableError";
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Round a coordinate to ~100 m so nearby searches share a cache entry. */
function roundCoord(n: number): number {
  return Number(n.toFixed(3));
}

// ---------------------------------------------------------------------------
// Foursquare Places (primary)
// ---------------------------------------------------------------------------

const FOURSQUARE_ENDPOINT = "https://places-api.foursquare.com/places/search";
// Foursquare pins its API behaviour to a dated version passed on every request.
const FOURSQUARE_API_VERSION = "2025-06-17";

interface FsqResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  // Older field shape kept as a defensive fallback.
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  location?: {
    locality?: string;
    region?: string;
    neighborhood?: string[] | string;
  };
  categories?: { name?: string; short_name?: string }[];
}

function fsqArea(loc: FsqResult["location"], destination: string): string {
  if (!loc) return destination;
  const hood = Array.isArray(loc.neighborhood) ? loc.neighborhood[0] : loc.neighborhood;
  return hood || loc.locality || loc.region || destination;
}

function parseFsq(r: FsqResult, preset: VibePreset, destination: string): VibePlace | null {
  const name = r.name?.trim();
  const lat = r.latitude ?? r.geocodes?.main?.latitude;
  const lng = r.longitude ?? r.geocodes?.main?.longitude;
  if (!name || lat == null || lng == null) return null;

  const area = fsqArea(r.location, destination);
  const catName = r.categories?.[0]?.short_name || r.categories?.[0]?.name;
  const blurb = catName ? `${catName} · near ${area}` : `${cap(preset.label)} near ${area}`;

  return { title: name, location: area, category: preset.category, blurb, lat, lng };
}

/**
 * One Foursquare search near a point, parsed to VibePlaces. Throws
 * ExploreUnavailableError on a non-OK response so the failure isn't cached and
 * the caller can fall back to Overpass. Only called when a key is configured.
 */
async function fetchFoursquare(
  preset: VibePreset,
  lat: number,
  lng: number,
  destination: string
): Promise<VibePlace[]> {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) throw new ExploreUnavailableError();

  const params = new URLSearchParams({
    query: preset.fsqQuery,
    ll: `${lat},${lng}`,
    radius: String(SEARCH_RADIUS_M),
    limit: String(RAW_CAP),
    fields: "name,latitude,longitude,location,categories",
  });

  const res = await fetch(`${FOURSQUARE_ENDPOINT}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Places-Api-Version": FOURSQUARE_API_VERSION,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new ExploreUnavailableError();

  const json = (await res.json()) as { results?: FsqResult[] };
  const results = Array.isArray(json.results) ? json.results : [];
  return results
    .map((r) => parseFsq(r, preset, destination))
    .filter((p): p is VibePlace => p !== null);
}

/** Foursquare results wrapped in the persistent Data Cache (keyed on the rounded
 *  centre + vibe query). Errors propagate uncached so we can fall back / retry. */
function fetchFoursquareCached(
  preset: VibePreset,
  lat: number,
  lng: number,
  destination: string
): Promise<VibePlace[]> {
  const rLat = roundCoord(lat);
  const rLng = roundCoord(lng);
  return unstable_cache(
    () => fetchFoursquare(preset, rLat, rLng, destination),
    ["explore-fsq", preset.fsqQuery, String(rLat), String(rLng), String(SEARCH_RADIUS_M)],
    { revalidate: POI_TTL_SECONDS }
  )();
}

// ---------------------------------------------------------------------------
// Overpass / OpenStreetMap (keyless fallback)
// ---------------------------------------------------------------------------

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
  throw new ExploreUnavailableError();
}

function parseOverpass(el: OverpassElement, preset: VibePreset, destination: string): VibePlace | null {
  const t = el.tags ?? {};
  // Prefer the English name when OSM has one (name:en); fall back to the
  // local-language name only when it doesn't.
  const name = (t["name:en"] ?? t.name)?.trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || lat == null || lng == null) return null;

  const area =
    t["addr:suburb:en"] || t["addr:neighbourhood:en"] || t["addr:city:en"] ||
    t["addr:suburb"] || t["addr:neighbourhood"] || t["addr:city"] || t["addr:town"] || destination;
  const cuisine = t.cuisine?.split(";")[0]?.replace(/_/g, " ");
  const blurb = cuisine ? `${cap(cuisine)} · near ${area}` : `${cap(preset.label)} near ${area}`;

  return { title: name, location: area, category: preset.category, blurb, lat, lng };
}

/** Overpass results wrapped in the persistent Data Cache. Errors propagate
 *  uncached (see fetchOverpass) so the UI can invite a retry. */
function fetchOverpassCached(
  preset: VibePreset,
  lat: number,
  lng: number,
  destination: string
): Promise<VibePlace[]> {
  const rLat = roundCoord(lat);
  const rLng = roundCoord(lng);
  return unstable_cache(
    async () => {
      const elements = await fetchOverpass(
        buildOverpassQuery(preset.filters, rLat, rLng, SEARCH_RADIUS_M, RAW_CAP)
      );
      return elements
        .map((el) => parseOverpass(el, preset, destination))
        .filter((p): p is VibePlace => p !== null);
    },
    ["explore-overpass", preset.filters.join("|"), String(rLat), String(rLng), String(SEARCH_RADIUS_M)],
    { revalidate: POI_TTL_SECONDS }
  )();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Dedupe by name, sort closest-to-centre first, and cap. */
function finalize(places: VibePlace[], center: { lat: number; lng: number }, limit: number): VibePlace[] {
  const seen = new Set<string>();
  const unique: VibePlace[] = [];
  for (const p of places) {
    const dedupe = p.title.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    unique.push(p);
  }
  return unique
    .map((p) => ({ p, d: haversineKm(center, { lat: p.lat, lng: p.lng }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * Suggestions for a vibe near a destination, closest-to-centre first. Uses
 * Foursquare when FOURSQUARE_API_KEY is set (falling back to Overpass if that
 * request fails), otherwise Overpass directly. Throws ExploreUnavailableError
 * when the active provider is busy/unreachable.
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

  if (process.env.FOURSQUARE_API_KEY) {
    try {
      const places = await fetchFoursquareCached(preset, center.lat, center.lng, destination);
      return finalize(places, center, limit);
    } catch {
      // Foursquare unavailable — fall through to the keyless Overpass path
      // rather than failing the whole search.
    }
  }

  const places = await fetchOverpassCached(preset, center.lat, center.lng, destination);
  return finalize(places, center, limit);
}
