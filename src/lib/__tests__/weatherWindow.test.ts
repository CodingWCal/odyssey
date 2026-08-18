import { describe, it, expect } from "vitest";
import { planWeatherWindow } from "@/components/shared/WeatherBanner";

// Fixed "now" so the horizon math is deterministic.
const NOW = new Date("2026-08-09T12:00:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("planWeatherWindow (ODY-023)", () => {
  it("a past trip is out of horizon → placeholder", () => {
    expect(planWeatherWindow(day("2026-07-01"), day("2026-07-05"), NOW)).toEqual({ unavailable: true });
  });

  it("a trip starting beyond the 15-day horizon → placeholder", () => {
    // Starts 20 days out.
    expect(planWeatherWindow(day("2026-08-29"), day("2026-09-02"), NOW)).toEqual({ unavailable: true });
  });

  it("a near-future trip requests from its start date", () => {
    const w = planWeatherWindow(day("2026-08-12"), day("2026-08-16"), NOW);
    expect(w).toEqual({ startStr: "2026-08-12", endStr: "2026-08-14" });
  });

  it("an in-progress trip requests from today, not the start date", () => {
    // Started Aug 7, ends Aug 14; today is Aug 9 → window begins today.
    const w = planWeatherWindow(day("2026-08-07"), day("2026-08-14"), NOW);
    expect(w).toEqual({ startStr: "2026-08-09", endStr: "2026-08-11" });
  });

  it("clamps the 3-day request to the forecast horizon edge", () => {
    // Trip starts exactly on the horizon (today+15 = Aug 24); +2 would exceed it.
    const w = planWeatherWindow(day("2026-08-24"), day("2026-08-28"), NOW);
    expect(w).toEqual({ startStr: "2026-08-24", endStr: "2026-08-24" });
  });

  it("a trip that already started and ends today is still in range", () => {
    const w = planWeatherWindow(day("2026-08-05"), day("2026-08-09"), NOW);
    expect(w).toEqual({ startStr: "2026-08-09", endStr: "2026-08-11" });
  });
});
