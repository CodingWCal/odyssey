import "server-only";

/**
 * Shared server-side geocoding via Nominatim (ODY-010). All lookups — the
 * browser autocomplete (through /api/geocode) and the itinerary actions — go
 * through here so the app presents one well-behaved client to OpenStreetMap:
 * descriptive User-Agent, cached responses, and no direct browser→Nominatim
 * traffic. Nominatim's usage policy is ~1 req/s per app; the cache absorbs
 * repeats and the API route soft-limits per user.
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
  // Evict oldest entries once full (Map preserves insertion order).
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + TTL_MS, data });
}

/**
 * Search Nominatim for up to `limit` place suggestions. Returns [] on any
 * failure — geocoding is always best-effort in this app.
 */
export async function searchPlaces(query: string, limit = 5): Promise<GeoSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const boundedLimit = Math.min(Math.max(limit, 1), 5);

  const key = cacheKey(q, boundedLimit);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${boundedLimit}`,
      {
        headers: {
          "Accept-Language": "en",
          // Nominatim usage policy requires a descriptive User-Agent.
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
  } catch {
    return [];
  }
}

/** Resolve an address to its best-match coordinates, or null. */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const results = await searchPlaces(address, 1);
  return results[0] ? { lat: results[0].lat, lng: results[0].lng } : null;
}
