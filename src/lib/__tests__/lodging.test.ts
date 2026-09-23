import { describe, it, expect } from "vitest";
import { isMultiNightLodging, lodgingPhaseForDay } from "@/lib/lodging";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("isMultiNightLodging", () => {
  it("is false for a non-hotel type regardless of checkOutDate", () => {
    expect(isMultiNightLodging("activity", day("2026-10-01"), day("2026-10-03"))).toBe(false);
  });

  it("is false when checkOutDate is null/undefined", () => {
    expect(isMultiNightLodging("hotel", day("2026-10-01"), null)).toBe(false);
    expect(isMultiNightLodging("hotel", day("2026-10-01"), undefined)).toBe(false);
  });

  it("is false when checkOutDate is the same day (single night, ordinary event)", () => {
    expect(isMultiNightLodging("hotel", day("2026-10-01"), day("2026-10-01"))).toBe(false);
  });

  it("is true when checkOutDate is a later day", () => {
    expect(isMultiNightLodging("hotel", day("2026-10-01"), day("2026-10-03"))).toBe(true);
  });
});

describe("lodgingPhaseForDay", () => {
  const checkIn = day("2026-10-01");
  const checkOut = day("2026-10-04");

  it("returns null for a day before check-in or after checkout", () => {
    expect(lodgingPhaseForDay(checkIn, checkOut, day("2026-09-30"))).toBeNull();
    expect(lodgingPhaseForDay(checkIn, checkOut, day("2026-10-05"))).toBeNull();
  });

  it("returns check-in on the first day", () => {
    expect(lodgingPhaseForDay(checkIn, checkOut, day("2026-10-01"))).toBe("check-in");
  });

  it("returns staying on the nights in between", () => {
    expect(lodgingPhaseForDay(checkIn, checkOut, day("2026-10-02"))).toBe("staying");
    expect(lodgingPhaseForDay(checkIn, checkOut, day("2026-10-03"))).toBe("staying");
  });

  it("returns check-out on the last day", () => {
    expect(lodgingPhaseForDay(checkIn, checkOut, day("2026-10-04"))).toBe("check-out");
  });

  it("a single-night stay's one day is both boundaries — check-in wins", () => {
    // isMultiNightLodging would already exclude this case, but the function
    // itself should still resolve deterministically if called directly.
    expect(lodgingPhaseForDay(checkIn, checkIn, day("2026-10-01"))).toBe("check-in");
  });
});
