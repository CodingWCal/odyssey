import { describe, it, expect } from "vitest";
import type { WindowPollInput } from "@/lib/scheduleWindow";
import { computeBestWindow } from "@/lib/scheduleWindow";

function slot(userId: string, date: string, status: "available" | "maybe" | "unavailable", block = "all_day") {
  return { userId, date, block: block as "all_day", status };
}

describe("computeBestWindow (ODY-110)", () => {
  it("never reports more available travelers than are actually free across the window", () => {
    // 4 travelers, all free on all 3 days of a 3-day window.
    const poll: WindowPollInput = {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-05",
      enabledBlocks: ["all_day"],
      desiredLengthDays: 3,
    };
    const slots = ["a", "b", "c", "d"].flatMap((u) => [
      slot(u, "2026-09-01", "available"),
      slot(u, "2026-09-02", "available"),
      slot(u, "2026-09-03", "available"),
    ]);

    const best = computeBestWindow(poll, slots);
    expect(best).not.toBeNull();
    // Bug was: summed each day's count (4+4+4=12) instead of the true
    // headcount, which can never exceed the number of distinct travelers.
    expect(best!.availableCount).toBe(4);
    expect(best!.availableCount).toBeLessThanOrEqual(4);
  });

  it("intersects availability — a traveler free on only some days of the window doesn't count", () => {
    const poll: WindowPollInput = {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-03",
      enabledBlocks: ["all_day"],
      desiredLengthDays: 3,
    };
    const slots = [
      // Alice free all 3 days.
      slot("alice", "2026-09-01", "available"),
      slot("alice", "2026-09-02", "available"),
      slot("alice", "2026-09-03", "available"),
      // Bob free only day 1 and day 2 — not the whole window.
      slot("bob", "2026-09-01", "available"),
      slot("bob", "2026-09-02", "available"),
    ];

    const best = computeBestWindow(poll, slots);
    expect(best!.startDate).toBe("2026-09-01");
    expect(best!.endDate).toBe("2026-09-03");
    expect(best!.availableCount).toBe(1); // only Alice is free every day
  });

  it("disjoint availability across a window can score well but intersect to zero", () => {
    const poll: WindowPollInput = {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-02",
      enabledBlocks: ["all_day"],
      desiredLengthDays: 2,
    };
    const slots = [
      slot("alice", "2026-09-01", "available"),
      slot("bob", "2026-09-02", "available"),
    ];

    const best = computeBestWindow(poll, slots);
    expect(best!.score).toBeGreaterThan(0); // both days have someone free
    expect(best!.availableCount).toBe(0); // nobody is free on both days
  });

  it("defaults to a 1-day window when desiredLengthDays is unset, matching per-day counts", () => {
    const poll: WindowPollInput = {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-02",
      enabledBlocks: ["all_day"],
      desiredLengthDays: null,
    };
    const slots = [
      slot("alice", "2026-09-01", "available"),
      slot("bob", "2026-09-01", "available"),
      slot("alice", "2026-09-02", "available"),
    ];

    const best = computeBestWindow(poll, slots);
    // Day 1 has 2 free (higher score) and should win over day 2's 1 free.
    expect(best!.startDate).toBe("2026-09-01");
    expect(best!.endDate).toBe("2026-09-01");
    expect(best!.availableCount).toBe(2);
  });

  it("weights maybe at half in score but excludes maybes from availableCount", () => {
    const poll: WindowPollInput = {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-01",
      enabledBlocks: ["all_day"],
      desiredLengthDays: 1,
    };
    const slots = [slot("alice", "2026-09-01", "available"), slot("bob", "2026-09-01", "maybe")];

    const best = computeBestWindow(poll, slots);
    expect(best!.score).toBe(1.5);
    expect(best!.availableCount).toBe(1);
  });

  it("returns null when no blocks are enabled", () => {
    const poll: WindowPollInput = {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-02",
      enabledBlocks: [],
      desiredLengthDays: 1,
    };
    expect(computeBestWindow(poll, [])).toBeNull();
  });

  it("returns null when the desired length exceeds the poll's range", () => {
    const poll: WindowPollInput = {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-02",
      enabledBlocks: ["all_day"],
      desiredLengthDays: 5,
    };
    expect(computeBestWindow(poll, [])).toBeNull();
  });
});
