/**
 * Straight-line ("as the crow flies") distances between a day's pinned stops
 * (ODY-065). Deliberately provider-free: this is the honest, dependency-free
 * half of the ticket — great-circle math, no routing API, no network, no key.
 * Callers must label the result as straight-line so it's never mistaken for a
 * walking/driving distance (rivers, one-ways, and detours all make the real
 * route longer). Pure and unit-tested; a routed-time upgrade can layer on top
 * later behind a provider.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometres between two points (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Compact human distance in km: "<0.1 km", "2.1 km" (one decimal under 10),
 * "14 km" (whole numbers above). Never travel time — straight-line only.
 */
export function formatKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 0.1) return "<0.1 km";
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
