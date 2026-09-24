import { describe, it, expect } from "vitest";
import {
  computeLegDayOffsets,
  layoverMinutes,
  formatDuration,
  isOvernightFlight,
  isOvernightSimple,
  type FlightLeg,
} from "@/lib/flightLegs";

function leg(from: string, to: string, departTime: string, arriveTime: string): FlightLeg {
  return {
    flightNumber: null,
    from,
    fromLat: null,
    fromLng: null,
    to,
    toLat: null,
    toLng: null,
    departTime,
    arriveTime,
    operatedBy: null,
  };
}

describe("computeLegDayOffsets", () => {
  it("a single same-day leg has no offset", () => {
    const offsets = computeLegDayOffsets([leg("BOS", "LAX", "11:45", "15:00")]);
    expect(offsets).toEqual([{ departDayOffset: 0, arriveDayOffset: 0 }]);
  });

  it("a leg that arrives before it departs (red-eye) lands the next day", () => {
    const offsets = computeLegDayOffsets([leg("BOS", "LAX", "23:00", "06:00")]);
    expect(offsets).toEqual([{ departDayOffset: 0, arriveDayOffset: 1 }]);
  });

  it("two same-day legs with a same-day layover stay at offset 0", () => {
    const offsets = computeLegDayOffsets([
      leg("BOS", "LAX", "11:45", "15:00"),
      leg("LAX", "HNL", "17:20", "20:03"),
    ]);
    expect(offsets).toEqual([
      { departDayOffset: 0, arriveDayOffset: 0 },
      { departDayOffset: 0, arriveDayOffset: 0 },
    ]);
  });

  it("a layover that crosses midnight carries into the next leg", () => {
    // Leg 1 arrives 23:30; leg 2 departs 07:00 — clock-earlier than the
    // arrival, so the layover is assumed to cross midnight.
    const offsets = computeLegDayOffsets([
      leg("BOS", "LAX", "18:00", "23:30"),
      leg("LAX", "HNL", "07:00", "10:00"),
    ]);
    expect(offsets).toEqual([
      { departDayOffset: 0, arriveDayOffset: 0 },
      { departDayOffset: 1, arriveDayOffset: 1 },
    ]);
  });

  it("an overnight layover after a same-day leg 1 still makes the overall trip cross a day", () => {
    // Leg 1 is a normal same-day hop. The layover itself crosses midnight,
    // and leg 2 is also same-day *relative to its own departure* — but the
    // cumulative offset must carry from the layover.
    const offsets = computeLegDayOffsets([
      leg("BOS", "LAX", "08:00", "11:00"),
      leg("LAX", "HNL", "08:00", "11:00"),
    ]);
    expect(offsets).toEqual([
      { departDayOffset: 0, arriveDayOffset: 0 },
      { departDayOffset: 1, arriveDayOffset: 1 },
    ]);
  });
});

describe("layoverMinutes", () => {
  it("computes a same-day layover", () => {
    const legs = [leg("BOS", "LAX", "11:45", "15:00"), leg("LAX", "HNL", "17:20", "20:03")];
    const offsets = computeLegDayOffsets(legs);
    expect(layoverMinutes(legs, offsets, 0)).toBe(140); // 15:00 -> 17:20
  });

  it("computes a layover that crosses midnight, accounting for the day carry", () => {
    const legs = [leg("BOS", "LAX", "18:00", "23:30"), leg("LAX", "HNL", "07:00", "10:00")];
    const offsets = computeLegDayOffsets(legs);
    // 23:30 -> next day 07:00 = 7h30m = 450 minutes.
    expect(layoverMinutes(legs, offsets, 0)).toBe(450);
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(375)).toBe("6h 15m");
  });
  it("formats whole hours with no minutes", () => {
    expect(formatDuration(120)).toBe("2h");
  });
  it("formats minutes only under an hour", () => {
    expect(formatDuration(45)).toBe("45m");
  });
  it("never goes negative", () => {
    expect(formatDuration(-10)).toBe("0m");
  });
});

describe("isOvernightFlight", () => {
  it("is false for an empty leg list", () => {
    expect(isOvernightFlight([])).toBe(false);
  });
  it("is false for an ordinary same-day single leg", () => {
    expect(isOvernightFlight([leg("BOS", "LAX", "11:45", "15:00")])).toBe(false);
  });
  it("is true for a red-eye single leg", () => {
    expect(isOvernightFlight([leg("BOS", "LAX", "23:00", "06:00")])).toBe(true);
  });
  it("is true when only the layover crosses midnight, not any single leg's own times", () => {
    const legs = [leg("BOS", "LAX", "08:00", "11:00"), leg("LAX", "HNL", "08:00", "11:00")];
    expect(isOvernightFlight(legs)).toBe(true);
  });
});

describe("isOvernightSimple", () => {
  it("is false with missing times", () => {
    expect(isOvernightSimple(null, "10:00")).toBe(false);
    expect(isOvernightSimple("10:00", undefined)).toBe(false);
  });
  it("is false for an ordinary same-day span", () => {
    expect(isOvernightSimple("11:45", "15:00")).toBe(false);
  });
  it("is true when the end time is earlier than the start time", () => {
    expect(isOvernightSimple("23:00", "06:00")).toBe(true);
  });
});
