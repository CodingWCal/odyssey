import { describe, it, expect } from "vitest";
import {
  parseDateString,
  enumerateDays,
  shiftDateUTC,
  daysBetweenUTC,
  dayKey,
  toDateInputValue,
  localDateKey,
} from "@/lib/dates";

describe("parseDateString", () => {
  it("parses YYYY-MM-DD as local midnight on the same calendar day", () => {
    const d = parseDateString("2026-07-10");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("handles leap day", () => {
    const d = parseDateString("2024-02-29");
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });
});

describe("toDateInputValue (ODY-048)", () => {
  it("keeps the UTC calendar day for <input type=date>", () => {
    // UTC midnight Jul 30 — local getDate() in US would be 29; input must stay 30.
    const utcMidnight = new Date("2026-07-30T00:00:00.000Z");
    expect(toDateInputValue(utcMidnight)).toBe("2026-07-30");
  });

  it("accepts ISO strings", () => {
    expect(toDateInputValue("2026-08-03T00:00:00.000Z")).toBe("2026-08-03");
  });

  it("returns empty string for invalid dates", () => {
    expect(toDateInputValue(new Date("nope"))).toBe("");
  });
});

describe("enumerateDays", () => {
  it("returns one date per calendar day, inclusive of both ends", () => {
    const days = enumerateDays(parseDateString("2026-07-10"), parseDateString("2026-07-13"));
    expect(days).toHaveLength(4);
    expect(days[0].getDate()).toBe(10);
    expect(days[3].getDate()).toBe(13);
  });

  it("returns a single day when start === end", () => {
    const days = enumerateDays(parseDateString("2026-07-10"), parseDateString("2026-07-10"));
    expect(days).toHaveLength(1);
  });

  it("returns [] when start is after end", () => {
    const days = enumerateDays(parseDateString("2026-07-11"), parseDateString("2026-07-10"));
    expect(days).toHaveLength(0);
  });

  it("crosses month boundaries", () => {
    const days = enumerateDays(parseDateString("2026-01-30"), parseDateString("2026-02-02"));
    expect(days.map((d) => d.getDate())).toEqual([30, 31, 1, 2]);
  });

  it("normalizes non-midnight inputs to local midnight", () => {
    const start = new Date(2026, 6, 10, 15, 30);
    const end = new Date(2026, 6, 11, 2, 0);
    const days = enumerateDays(start, end);
    expect(days).toHaveLength(2);
    expect(days.every((d) => d.getHours() === 0)).toBe(true);
  });
});

describe("dayKey", () => {
  it("keys by local calendar day regardless of time", () => {
    expect(dayKey(new Date(2026, 6, 10, 0, 0))).toBe(dayKey(new Date(2026, 6, 10, 23, 59)));
    expect(dayKey(new Date(2026, 6, 10))).not.toBe(dayKey(new Date(2026, 6, 11)));
  });
});

describe("localDateKey (ODY-076)", () => {
  it("formats the local calendar day as YYYY-MM-DD", () => {
    expect(localDateKey(new Date(2026, 6, 25, 20, 30))).toBe("2026-07-25");
  });

  it("pads single-digit month and day", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("matches a UTC-midnight day key for the same calendar date", () => {
    // Traveler on Jul 25 local should match Day stored as 2026-07-25T00:00:00Z.
    expect(localDateKey(new Date(2026, 6, 25, 9, 0))).toBe(
      toDateInputValue(new Date("2026-07-25T00:00:00.000Z"))
    );
  });
});

describe("shiftDateUTC / daysBetweenUTC (ODY-033)", () => {
  const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

  it("shifts a UTC-midnight date forward by whole days", () => {
    expect(shiftDateUTC(utc("2026-07-10"), 5).toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("shifts backward with a negative delta", () => {
    expect(shiftDateUTC(utc("2026-07-10"), -3).toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });

  it("rolls across a month boundary", () => {
    expect(shiftDateUTC(utc("2026-07-30"), 4).toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });

  it("is a no-op for a zero delta", () => {
    expect(shiftDateUTC(utc("2026-12-31"), 0).toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("measures the whole-day gap between two dates", () => {
    expect(daysBetweenUTC(utc("2026-07-10"), utc("2026-07-17"))).toBe(7);
    expect(daysBetweenUTC(utc("2026-07-17"), utc("2026-07-10"))).toBe(-7);
    expect(daysBetweenUTC(utc("2026-07-10"), utc("2026-07-10"))).toBe(0);
  });

  it("round-trips: shifting by the measured delta lands on the target", () => {
    const from = utc("2026-07-10");
    const to = utc("2026-09-02");
    expect(shiftDateUTC(from, daysBetweenUTC(from, to)).toISOString()).toBe(to.toISOString());
  });
});
