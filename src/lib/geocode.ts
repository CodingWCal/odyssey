import "server-only";

/**
 * Shared server-side geocoding via Nominatim (ODY-010 / ODY-055). All lookups —
 * browser autocomplete (through /api/geocode) and itinerary/Explore/collections
 * actions — go through here so the app presents one well-behaved client to
 * OpenStreetMap: descriptive User-Agent, cached responses, and a shared
 * per-user soft rate limit.
 */

export interface GeoSuggestion {
  display: string;
  lat: number;
  lng: number;
}

const USER_AGENT = "Odyssey-TripPlanner/1.0 (collaborative itinerary app)";

// Best-effort in-memory TTL cache keyed on the normalized query. Serverless
// instances each get their own copy — that's fine; it's a politeness cache,
// not a correctness guarantee.
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { expires: number; data: GeoSuggestion[] }>();

// Soft per-user rate limit shared by /api/geocode and server actions (ODY-055).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const usage = new Map<string, { windowStart: number; count: number }>();

export class GeocodeRateLimitError extends Error {
  constructor() {
    super("Too many location lookups — try again in a minute.");
    this.name = "GeocodeRateLimitError";
  }
}

function pruneUsage() {
  if (usage.size < 1000) return;
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of usage) {
    if (entry.windowStart < cutoff) usage.delete(key);
  }
}

/**
 * Consume one Nominatim quota unit for `userKey`. Throws when over limit.
 * Call only on cache-miss paths so repeats stay free.
 */
export function assertGeocodeAllowed(userKey: string) {
  pruneUsage();
  const now = Date.now();
  const entry = usage.get(userKey);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    usage.set(userKey, { windowStart: now, count: 1 });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    throw new GeocodeRateLimitError();
  }
}

function cacheKey(q: string, limit: number) {
  return `${limit}|${q.trim().toLowerCase()}`;
}

function readCache(key: string): GeoSuggestion[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function writeCache(key: string, data: GeoSuggestion[]) {
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + TTL_MS, data });
}

/**
 * Search Nominatim for up to `limit` place suggestions. Returns [] on soft
 * network failure. Throws GeocodeRateLimitError when `userKey` is over quota
 * on a cache miss.
 */
export async function searchPlaces(
  query: string,
  limit = 5,
  opts?: { userKey?: string }
): Promise<GeoSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const boundedLimit = Math.min(Math.max(limit, 1), 5);

  const key = cacheKey(q, boundedLimit);
  const cached = readCache(key);
  if (cached) return cached;

  if (opts?.userKey) {
    assertGeocodeAllowed(opts.userKey);
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${boundedLimit}`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": USER_AGENT,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results: GeoSuggestion[] = (Array.isArray(data) ? data : [])
      .map((d: { display_name?: string; lat?: string; lon?: string }) => ({
        display: d.display_name ?? "",
        lat: parseFloat(d.lat ?? ""),
        lng: parseFloat(d.lon ?? ""),
      }))
      .filter((s) => s.display && !Number.isNaN(s.lat) && !Number.isNaN(s.lng));
    writeCache(key, results);
    return results;
  } catch (err) {
    if (err instanceof GeocodeRateLimitError) throw err;
    return [];
  }
}

/** Resolve an address to its best-match coordinates, or null. */
export async function geocode(
  address: string,
  opts?: { userKey?: string }
): Promise<{ lat: number; lng: number } | null> {
  const results = await searchPlaces(address, 1, opts);
  return results[0] ? { lat: results[0].lat, lng: results[0].lng } : null;
}
