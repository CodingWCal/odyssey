import { describe, it, expect } from "vitest";
import { parseDateString, enumerateDays, dayKey, toDateInputValue } from "@/lib/dates";

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
