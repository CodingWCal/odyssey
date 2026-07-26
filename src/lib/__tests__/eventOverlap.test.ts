import { describe, it, expect } from "vitest";
import { findOverlaps } from "@/lib/eventOverlap";

const e = (id: string, title: string, startTime: string | null, endTime: string | null = null) => ({
  id, title, startTime, endTime,
});

describe("findOverlaps (ODY-077)", () => {
  it("returns empty when nothing overlaps", () => {
    const m = findOverlaps([
      e("a", "Brunch", "10:00", "11:00"),
      e("b", "Museum", "14:00", "16:00"),
    ]);
    expect(m.size).toBe(0);
  });

  it("flags overlapping timed events", () => {
    const m = findOverlaps([
      e("a", "Dinner", "19:00", "21:00"),
      e("b", "Show", "20:00", "22:00"),
    ]);
    expect(m.get("a")).toEqual(["Show"]);
    expect(m.get("b")).toEqual(["Dinner"]);
  });

  it("ignores untimed events", () => {
    const m = findOverlaps([
      e("a", "Dinner", "19:00", "21:00"),
      e("b", "Maybe", null, null),
    ]);
    expect(m.size).toBe(0);
  });

  it("treats missing end as +60 minutes", () => {
    const m = findOverlaps([
      e("a", "Coffee", "10:00", null),
      e("b", "Walk", "10:30", "11:00"),
    ]);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(true);
  });

  it("does not flag adjacent non-overlapping ranges", () => {
    const m = findOverlaps([
      e("a", "A", "10:00", "11:00"),
      e("b", "B", "11:00", "12:00"),
    ]);
    expect(m.size).toBe(0);
  });
});
