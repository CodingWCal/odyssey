import { describe, it, expect } from "vitest";
import { fillSlots } from "./scheduleShared";
import type { AvailabilityBlock } from "@/types";

describe("fillSlots", () => {
  const blocks: AvailabilityBlock[] = ["morning", "afternoon", "evening"];

  it("builds the cartesian product of dates and blocks at one status", () => {
    const out = fillSlots(["2026-09-12", "2026-09-13"], blocks, "available");
    expect(out).toHaveLength(6);
    expect(out[0]).toEqual({ date: "2026-09-12", block: "morning", status: "available" });
    expect(out).toContainEqual({ date: "2026-09-13", block: "evening", status: "available" });
    expect(out.every((s) => s.status === "available")).toBe(true);
  });

  it("handles a single date (whole-day fill)", () => {
    const out = fillSlots(["2026-09-12"], blocks, "available");
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.block)).toEqual(["morning", "afternoon", "evening"]);
  });

  it("handles a single block across many dates (whole-column fill)", () => {
    const out = fillSlots(["2026-09-12", "2026-09-13", "2026-09-14"], ["all_day"], "available");
    expect(out).toHaveLength(3);
    expect(out.every((s) => s.block === "all_day")).toBe(true);
  });

  it("returns nothing when there are no dates or no blocks", () => {
    expect(fillSlots([], blocks, "available")).toEqual([]);
    expect(fillSlots(["2026-09-12"], [], "available")).toEqual([]);
  });
});
