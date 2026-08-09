import { describe, it, expect } from "vitest";
import {
  computeSplit,
  suggestSettlements,
  weightedSharesCents,
  equalSharesCents,
  aggregateBalances,
  classifyBalance,
} from "@/lib/budget";

describe("classifyBalance (ODY-116)", () => {
  it("classifies a positive balance as owed", () => {
    expect(classifyBalance(47.5)).toBe("owed");
  });

  it("classifies a negative balance as owe", () => {
    expect(classifyBalance(-32)).toBe("owe");
  });

  it("classifies exact zero as settled", () => {
    expect(classifyBalance(0)).toBe("settled");
  });

  it("treats rounding dust as settled, matching suggestSettlements' epsilon", () => {
    expect(classifyBalance(0.003)).toBe("settled");
    expect(classifyBalance(-0.003)).toBe("settled");
  });

  it("does not treat a genuine small balance as dust", () => {
    expect(classifyBalance(0.01)).toBe("owed");
    expect(classifyBalance(-0.01)).toBe("owe");
  });
});

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
    expect(rows[0].balance).toBe(50);
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
    expect(rows.reduce((s, r) => s + r.balance, 0)).toBeCloseTo(0);
  });

  it("handles an empty member list", () => {
    expect(computeSplit([], 100)).toEqual([]);
  });

  it("reconciles shares to the cent for awkward totals", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 1, paid: 0 },
        { id: "b", weight: 1, paid: 0 },
        { id: "c", weight: 1, paid: 100 },
      ],
      100
    );
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(100, 2);
  });
});

describe("suggestSettlements (ODY-030)", () => {
  it("suggests one transfer for a simple two-person imbalance", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 1, paid: 100 },
        { id: "b", weight: 1, paid: 0 },
      ],
      100
    );
    expect(suggestSettlements(rows)).toEqual([{ fromId: "b", toId: "a", amount: 50 }]);
  });

  it("returns empty when already settled", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 1, paid: 50 },
        { id: "b", weight: 1, paid: 50 },
      ],
      100
    );
    expect(suggestSettlements(rows)).toEqual([]);
  });

  it("clears all balances with minimal transfers", () => {
    const rows = computeSplit(
      [
        { id: "a", weight: 1, paid: 90 },
        { id: "b", weight: 1, paid: 0 },
        { id: "c", weight: 1, paid: 30 },
      ],
      120
    );
    const s = suggestSettlements(rows);
    expect(s.length).toBeGreaterThan(0);
    const bal = new Map(rows.map((r) => [r.id, r.balance]));
    for (const t of s) {
      bal.set(t.fromId, (bal.get(t.fromId) ?? 0) + t.amount);
      bal.set(t.toId, (bal.get(t.toId) ?? 0) - t.amount);
    }
    for (const v of bal.values()) expect(Math.abs(v)).toBeLessThan(0.02);
  });
});

describe("weightedSharesCents / equalSharesCents (ODY-094)", () => {
  it("splits evenly (uniform weight) and reconciles to the cent for an awkward total", () => {
    const shares = equalSharesCents(["a", "b", "c"], 100);
    expect(shares.reduce((s, x) => s + x.amountCents, 0)).toBe(100);
    // 100/3 = 33.33... — largest-remainder gives two 33s and one 34.
    expect(shares.map((s) => s.amountCents).sort()).toEqual([33, 33, 34]);
  });

  it("weights proportionally", () => {
    const shares = weightedSharesCents(
      [
        { userId: "a", weight: 2 },
        { userId: "b", weight: 1 },
        { userId: "c", weight: 1 },
      ],
      4000
    );
    expect(shares).toEqual([
      { userId: "a", amountCents: 2000 },
      { userId: "b", amountCents: 1000 },
      { userId: "c", amountCents: 1000 },
    ]);
  });

  it("falls back to equal when all weights are zero", () => {
    const shares = weightedSharesCents(
      [{ userId: "a", weight: 0 }, { userId: "b", weight: 0 }],
      100
    );
    expect(shares).toEqual([
      { userId: "a", amountCents: 50 },
      { userId: "b", amountCents: 50 },
    ]);
  });

  it("handles a single person (100% of the bill)", () => {
    expect(equalSharesCents(["solo"], 4999)).toEqual([{ userId: "solo", amountCents: 4999 }]);
  });
});

describe("aggregateBalances (ODY-094 Stage B)", () => {
  it("aggregates paid/owed across multiple expenses into real per-member balances", () => {
    const balances = aggregateBalances(
      ["alex", "maya", "sam"],
      [
        // Group dinner, all three, equal.
        {
          amountCents: 9000,
          paidByUserId: "alex",
          shares: [
            { userId: "alex", amountCents: 3000 },
            { userId: "maya", amountCents: 3000 },
            { userId: "sam", amountCents: 3000 },
          ],
        },
        // A side transaction between just two people — doesn't touch sam.
        {
          amountCents: 2000,
          paidByUserId: "maya",
          shares: [
            { userId: "alex", amountCents: 500 },
            { userId: "maya", amountCents: 1500 },
          ],
        },
      ]
    );
    const byId = Object.fromEntries(balances.map((b) => [b.userId, b]));
    expect(byId.alex).toEqual({ userId: "alex", paidCents: 9000, owedCents: 3500, balanceCents: 5500 });
    expect(byId.maya).toEqual({ userId: "maya", paidCents: 2000, owedCents: 4500, balanceCents: -2500 });
    expect(byId.sam).toEqual({ userId: "sam", paidCents: 0, owedCents: 3000, balanceCents: -3000 });
  });

  it("a side transaction between two people never touches an uninvolved member's balance", () => {
    const balances = aggregateBalances(
      ["a", "b", "c"],
      [{ amountCents: 1000, paidByUserId: "a", shares: [{ userId: "a", amountCents: 500 }, { userId: "b", amountCents: 500 }] }]
    );
    const c = balances.find((b) => b.userId === "c")!;
    expect(c).toEqual({ userId: "c", paidCents: 0, owedCents: 0, balanceCents: 0 });
  });

  it("drops contributions from a userId no longer on the trip instead of crashing", () => {
    const balances = aggregateBalances(
      ["a"],
      [{ amountCents: 1000, paidByUserId: "departed-member", shares: [{ userId: "a", amountCents: 500 }, { userId: "departed-member", amountCents: 500 }] }]
    );
    expect(balances).toEqual([{ userId: "a", paidCents: 0, owedCents: 500, balanceCents: -500 }]);
  });

  it("returns zeroed balances for an empty expense list", () => {
    expect(aggregateBalances(["a", "b"], [])).toEqual([
      { userId: "a", paidCents: 0, owedCents: 0, balanceCents: 0 },
      { userId: "b", paidCents: 0, owedCents: 0, balanceCents: 0 },
    ]);
  });
});

describe("aggregateBalances with settlements (ODY-107)", () => {
  it("a settlement clears the exact amount owed, moving both balances toward zero", () => {
    // Sam owes Alex $30 from an expense; Sam pays Alex $30 outside the app.
    const balances = aggregateBalances(
      ["alex", "sam"],
      [{ amountCents: 3000, paidByUserId: "alex", shares: [{ userId: "sam", amountCents: 3000 }] }],
      [{ fromUserId: "sam", toUserId: "alex", amountCents: 3000 }]
    );
    const byId = Object.fromEntries(balances.map((b) => [b.userId, b]));
    // paid/owed (pure expense figures) stay unchanged by the settlement.
    expect(byId.alex).toMatchObject({ paidCents: 3000, owedCents: 0, balanceCents: 0 });
    expect(byId.sam).toMatchObject({ paidCents: 0, owedCents: 3000, balanceCents: 0 });
  });

  it("a partial settlement leaves the remainder outstanding", () => {
    const balances = aggregateBalances(
      ["alex", "sam"],
      [{ amountCents: 3000, paidByUserId: "alex", shares: [{ userId: "sam", amountCents: 3000 }] }],
      [{ fromUserId: "sam", toUserId: "alex", amountCents: 1000 }]
    );
    const byId = Object.fromEntries(balances.map((b) => [b.userId, b]));
    expect(byId.alex.balanceCents).toBe(2000);
    expect(byId.sam.balanceCents).toBe(-2000);
  });

  it("a settlement between two people never touches an uninvolved third person's balance", () => {
    const balances = aggregateBalances(
      ["alex", "maya", "sam"],
      [{ amountCents: 9000, paidByUserId: "alex", shares: [
        { userId: "alex", amountCents: 3000 },
        { userId: "maya", amountCents: 3000 },
        { userId: "sam", amountCents: 3000 },
      ] }],
      [{ fromUserId: "maya", toUserId: "alex", amountCents: 3000 }]
    );
    const byId = Object.fromEntries(balances.map((b) => [b.userId, b]));
    expect(byId.sam.balanceCents).toBe(-3000); // unaffected by the maya->alex settlement
    expect(byId.maya.balanceCents).toBe(0);
    expect(byId.alex.balanceCents).toBe(3000); // still owed by sam
  });

  it("drops a settlement referencing a userId no longer on the trip", () => {
    const balances = aggregateBalances(
      ["alex"],
      [],
      [{ fromUserId: "departed", toUserId: "alex", amountCents: 1000 }]
    );
    expect(balances).toEqual([{ userId: "alex", paidCents: 0, owedCents: 0, balanceCents: -1000 }]);
  });

  it("defaults to no settlements when the argument is omitted", () => {
    const balances = aggregateBalances(
      ["alex", "sam"],
      [{ amountCents: 3000, paidByUserId: "alex", shares: [{ userId: "sam", amountCents: 3000 }] }]
    );
    const sam = balances.find((b) => b.userId === "sam")!;
    expect(sam.balanceCents).toBe(-3000);
  });
});
