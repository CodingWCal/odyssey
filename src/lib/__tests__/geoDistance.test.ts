import { describe, it, expect } from "vitest";
import { haversineKm, formatKm } from "@/lib/geoDistance";

describe("haversineKm (ODY-065)", () => {
  it("is zero for identical points", () => {
    expect(haversineKm({ lat: 40.7, lng: -74 }, { lat: 40.7, lng: -74 })).toBe(0);
  });

  it("matches a known city pair within 1%", () => {
    // Paris ↔ London ≈ 344 km great-circle.
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 });
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(348);
  });

  it("is symmetric", () => {
    const a = { lat: 35.68, lng: 139.77 };
    const b = { lat: 34.05, lng: -118.24 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });

  it("computes a short intra-city hop", () => {
    // Louvre ↔ Notre-Dame ≈ 1.6 km.
    const d = haversineKm({ lat: 48.8606, lng: 2.3376 }, { lat: 48.8530, lng: 2.3499 });
    expect(d).toBeGreaterThan(1.2);
    expect(d).toBeLessThan(2.0);
  });

  it("handles antipodal-ish spans without NaN (asin clamp)", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(Math.PI * 6371, 0); // half the great circle
  });
});

describe("formatKm", () => {
  it("shows one decimal under 10 km", () => {
    expect(formatKm(2.14)).toBe("2.1 km");
  });
  it("rounds to whole km at 10 and above", () => {
    expect(formatKm(14.6)).toBe("15 km");
  });
  it("collapses tiny distances", () => {
    expect(formatKm(0.04)).toBe("<0.1 km");
  });
  it("returns empty for invalid input", () => {
    expect(formatKm(NaN)).toBe("");
    expect(formatKm(-3)).toBe("");
  });
});
