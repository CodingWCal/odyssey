import { describe, it, expect } from "vitest";
import { computeSplit } from "@/lib/budget";

describe("computeSplit", () => {
  it("splits equally with equal weights", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 1, paid: 100 },
        { id: "b", weight: 1, paid: 0 },
      ],
      100
    );
    expect(rows[0].share).toBe(50);
    expect(rows[1].share).toBe(50);
    expect(rows[0].balance).toBe(50); // paid 100, owes 50 → is owed 50
    expect(rows[1].balance).toBe(-50);
  });

  it("weights shares proportionally", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 2, paid: 0 },
        { id: "b", weight: 1, paid: 0 },
        { id: "c", weight: 1, paid: 0 },
      ],
      400
    );
    expect(rows[0].share).toBe(200);
    expect(rows[1].share).toBe(100);
    expect(rows[2].share).toBe(100);
    expect(rows[0].pct).toBeCloseTo(0.5);
  });

  it("falls back to equal split when all weights are zero", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 0, paid: 0 },
        { id: "b", weight: 0, paid: 0 },
      ],
      100
    );
    expect(rows[0].share).toBe(50);
    expect(rows[1].share).toBe(50);
  });

  it("clamps negative weights to zero", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: -5, paid: 0 },
        { id: "b", weight: 1, paid: 0 },
      ],
      100
    );
    expect(rows[0].share).toBe(0);
    expect(rows[1].share).toBe(100);
  });

  it("a zero-weight member owes nothing and is owed what they paid", () => {
    const rows = computeSplit(
      [
        { id: "viewer", weight: 0, paid: 30 },
        { id: "b", weight: 1, paid: 70 },
      ],
      100
    );
    expect(rows[0].share).toBe(0);
    expect(rows[0].balance).toBe(30);
    expect(rows[1].share).toBe(100);
  });

  it("balances sum to zero when payments cover the total", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 3, paid: 120 },
        { id: "b", weight: 1, paid: 40 },
        { id: "c", weight: 4, paid: 40 },
      ],
      200
    );
    const sum = rows.reduce((s, r) => s + r.balance, 0);
    expect(sum).toBeCloseTo(0);
  });

  it("handles an empty member list", () => {
    expect(computeSplit([], 100)).toEqual([]);
  });
});
