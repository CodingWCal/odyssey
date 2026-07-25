import { describe, it, expect } from "vitest";
import {
  createTripSchema,
  createEventSchema,
  createExpenseSchema,
  updateExpenseSchema,
  updateBudgetSchema,
  updateSplitSchema,
  setSlotsSchema,
} from "@/lib/validations";

const validTrip = {
  title: "Tokyo",
  destination: "Tokyo, Japan",
  startDate: "2026-07-10",
  endDate: "2026-07-14",
};

describe("date validation (audit #3)", () => {
  it("accepts a real YYYY-MM-DD date", () => {
    expect(createTripSchema.safeParse(validTrip).success).toBe(true);
  });

  it("accepts a leap day in a leap year", () => {
    expect(
      createTripSchema.safeParse({ ...validTrip, startDate: "2024-02-29", endDate: "2024-03-01" }).success
    ).toBe(true);
  });

  it.each(["2026-02-30", "2026-02-29", "2026-13-01", "not-a-date", "", "07/10/2026"])(
    "rejects %s",
    (bad) => {
      expect(createTripSchema.safeParse({ ...validTrip, startDate: bad }).success).toBe(false);
    }
  );
});

describe("money caps (ODY-004 / audit #6)", () => {
  it("caps trip budget at 10M and rejects Infinity/NaN", () => {
    expect(updateBudgetSchema.safeParse({ tripId: "t", totalBudget: 5000 }).success).toBe(true);
    expect(updateBudgetSchema.safeParse({ tripId: "t", totalBudget: 10_000_001 }).success).toBe(false);
    expect(updateBudgetSchema.safeParse({ tripId: "t", totalBudget: Infinity }).success).toBe(false);
    expect(updateBudgetSchema.safeParse({ tripId: "t", totalBudget: -1 }).success).toBe(false);
  });

  it("caps event cost", () => {
    const base = { dayId: "d", tripId: "t", type: "activity", title: "Hike" };
    expect(createEventSchema.safeParse({ ...base, cost: 100 }).success).toBe(true);
    expect(createEventSchema.safeParse({ ...base, cost: 10_000_001 }).success).toBe(false);
  });

  it("requires expense amount > 0 and <= 10M", () => {
    const base = { tripId: "t", label: "Dinner", category: "food" };
    expect(createExpenseSchema.safeParse({ ...base, amount: 12.5 }).success).toBe(true);
    expect(createExpenseSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...base, amount: 10_000_001 }).success).toBe(false);
  });

  it("rejects invalid updateExpense payloads (ODY-054)", () => {
    const ok = { label: "Taxi", amount: 20, category: "transport" };
    expect(updateExpenseSchema.safeParse(ok).success).toBe(true);
    expect(updateExpenseSchema.safeParse({ ...ok, amount: -1 }).success).toBe(false);
    expect(updateExpenseSchema.safeParse({ ...ok, amount: Infinity }).success).toBe(false);
    expect(updateExpenseSchema.safeParse({ ...ok, category: "not-real" }).success).toBe(false);
  });
});

describe("split weights (ODY-004)", () => {
  it("accepts weights in 0..100", () => {
    expect(
      updateSplitSchema.safeParse({ tripId: "t", weights: [{ memberId: "m", weight: 2 }] }).success
    ).toBe(true);
  });

  it("rejects out-of-range and non-finite weights", () => {
    for (const weight of [-1, 101, Infinity]) {
      expect(
        updateSplitSchema.safeParse({ tripId: "t", weights: [{ memberId: "m", weight }] }).success
      ).toBe(false);
    }
  });
});

describe("availability slots (audit DoS cap)", () => {
  const slot = { date: "2026-07-10", block: "morning", status: "available" };

  it("accepts a normal batch", () => {
    expect(setSlotsSchema.safeParse({ tripId: "t", slots: [slot] }).success).toBe(true);
  });

  it("rejects batches over 2000 entries", () => {
    const slots = Array.from({ length: 2001 }, () => slot);
    expect(setSlotsSchema.safeParse({ tripId: "t", slots }).success).toBe(false);
  });

  it("rejects malformed slot dates", () => {
    expect(
      setSlotsSchema.safeParse({ tripId: "t", slots: [{ ...slot, date: "garbage" }] }).success
    ).toBe(false);
  });
});

describe("event schema basics", () => {
  it("rejects unknown event types", () => {
    expect(
      createEventSchema.safeParse({ dayId: "d", tripId: "t", type: "spacewalk", title: "X" }).success
    ).toBe(false);
  });

  it("requires a title", () => {
    expect(
      createEventSchema.safeParse({ dayId: "d", tripId: "t", type: "activity", title: "" }).success
    ).toBe(false);
  });
});
