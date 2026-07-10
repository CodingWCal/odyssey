import { describe, it, expect, vi } from "vitest";
import { syncLinkedExpense, EVENT_TYPE_TO_CATEGORY, type ExpenseClient } from "@/lib/expenses";

/** Minimal stub of the Prisma expense delegate. */
function makeStub(existing: { id: string } | null) {
  const stub = {
    expense: {
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
  return { stub, tx: stub as unknown as ExpenseClient };
}

const baseEvent = {
  id: "evt1",
  tripId: "trip1",
  type: "restaurant",
  title: "Dinner at Den",
  createdBy: "user1",
};

describe("syncLinkedExpense", () => {
  it("creates a linked expense for a new positive cost", async () => {
    const { stub, tx } = makeStub(null);
    await syncLinkedExpense({ ...baseEvent, cost: 120 }, tx);
    expect(stub.expense.create).toHaveBeenCalledWith({
      data: {
        tripId: "trip1",
        eventId: "evt1",
        label: "Dinner at Den",
        amount: 120,
        category: "food",
        addedBy: "user1",
      },
    });
    expect(stub.expense.update).not.toHaveBeenCalled();
    expect(stub.expense.delete).not.toHaveBeenCalled();
  });

  it("updates the existing linked expense when cost changes", async () => {
    const { stub, tx } = makeStub({ id: "exp1" });
    await syncLinkedExpense({ ...baseEvent, cost: 80 }, tx);
    expect(stub.expense.update).toHaveBeenCalledWith({
      where: { id: "exp1" },
      data: { amount: 80 },
    });
    expect(stub.expense.create).not.toHaveBeenCalled();
  });

  it("deletes the linked expense when cost is cleared", async () => {
    const { stub, tx } = makeStub({ id: "exp1" });
    await syncLinkedExpense({ ...baseEvent, cost: null }, tx);
    expect(stub.expense.delete).toHaveBeenCalledWith({ where: { id: "exp1" } });
  });

  it("deletes the linked expense when cost is zero", async () => {
    const { stub, tx } = makeStub({ id: "exp1" });
    await syncLinkedExpense({ ...baseEvent, cost: 0 }, tx);
    expect(stub.expense.delete).toHaveBeenCalled();
  });

  it("does nothing when there is no cost and no linked expense", async () => {
    const { stub, tx } = makeStub(null);
    await syncLinkedExpense({ ...baseEvent, cost: null }, tx);
    expect(stub.expense.create).not.toHaveBeenCalled();
    expect(stub.expense.update).not.toHaveBeenCalled();
    expect(stub.expense.delete).not.toHaveBeenCalled();
  });

  it("falls back to misc for unknown event types", async () => {
    const { stub, tx } = makeStub(null);
    await syncLinkedExpense({ ...baseEvent, type: "spacewalk", cost: 10 }, tx);
    expect(stub.expense.create.mock.calls[0][0].data.category).toBe("misc");
  });

  it("maps every event type to a budget category", () => {
    for (const t of ["flight", "hotel", "restaurant", "activity", "transport", "misc"]) {
      expect(EVENT_TYPE_TO_CATEGORY[t]).toBeTruthy();
    }
  });
});
