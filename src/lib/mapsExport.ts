/**
 * Build a Google Maps URL for a day's ordered stops (ODY-072). One located
 * stop opens a search pin; two or more open turn-by-turn directions through
 * them *in order* (the `maps/dir/A/B/C` path form preserves sequence).
 * Returns null when nothing is geolocated, so callers can hide the link.
 */
export interface GeoPoint {
  lat: number | null | undefined;
  lng: number | null | undefined;
}

function isLocated(p: GeoPoint): p is { lat: number; lng: number } {
  return typeof p.lat === "number" && Number.isFinite(p.lat) && typeof p.lng === "number" && Number.isFinite(p.lng);
}

export function googleMapsUrl(points: GeoPoint[]): string | null {
  const located = points.filter(isLocated);
  if (located.length === 0) return null;
  const coord = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`;
  if (located.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord(located[0]))}`;
  }
  return `https://www.google.com/maps/dir/${located.map(coord).join("/")}`;
}
