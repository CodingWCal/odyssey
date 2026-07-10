import type { Prisma } from "@/generated/prisma/client";

/**
 * Event↔expense linkage (extracted from the itinerary actions for
 * testability, ODY-016). The Prisma client is injected — callers pass `db` or
 * a transaction client — so tests can substitute a stub.
 */

// Event type → budget expense category.
export const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  flight: "flights",
  hotel: "lodging",
  restaurant: "food",
  activity: "activities",
  transport: "transport",
  misc: "misc",
};

export interface LinkedExpenseEvent {
  id: string;
  tripId: string;
  type: string;
  title: string;
  cost: number | null;
  createdBy: string;
}

/** The slice of the Prisma client syncLinkedExpense actually needs. */
export type ExpenseClient = Pick<Prisma.TransactionClient, "expense">;

/**
 * Keep a budget expense in sync with an event's cost (#5). Itinerary owns the
 * price: a positive cost creates/updates a linked expense; clearing it removes
 * the link. The expense stays editable on the Budget page.
 */
export async function syncLinkedExpense(event: LinkedExpenseEvent, tx: ExpenseClient) {
  const existing = await tx.expense.findFirst({ where: { eventId: event.id } });
  if (event.cost != null && event.cost > 0) {
    if (existing) {
      await tx.expense.update({ where: { id: existing.id }, data: { amount: event.cost } });
    } else {
      await tx.expense.create({
        data: {
          tripId: event.tripId,
          eventId: event.id,
          label: event.title,
          amount: event.cost,
          category: EVENT_TYPE_TO_CATEGORY[event.type] ?? "misc",
          addedBy: event.createdBy,
        },
      });
    }
  } else if (existing) {
    await tx.expense.delete({ where: { id: existing.id } });
  }
}
