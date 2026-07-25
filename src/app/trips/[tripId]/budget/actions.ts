"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import {
  createExpenseSchema,
  updateExpenseSchema,
  updateSplitSchema,
  updateBudgetSchema,
  type UpdateSplitInput,
} from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

/** Reject linking an expense to an event on a different trip (ODY-054). */
async function assertEventOnTrip(eventId: string | null | undefined, tripId: string) {
  if (!eventId) return;
  const event = await db.event.findFirst({
    where: { id: eventId, tripId },
    select: { id: true },
  });
  if (!event) throw new Error("Not found");
}

export async function createExpense(data: {
  tripId: string;
  eventId?: string;
  label: string;
  amount: number;
  category: string;
}) {
  const dbUser = await getDbUser();
  await assertTripRole(data.tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = createExpenseSchema.parse(data);
  const eventId = validated.eventId || null;
  await assertEventOnTrip(eventId, validated.tripId);

  const expense = await db.expense.create({
    data: {
      tripId: validated.tripId,
      eventId,
      label: validated.label,
      amount: validated.amount,
      category: validated.category,
      addedBy: dbUser.id,
    },
  });

  revalidatePath(`/trips/${validated.tripId}/budget`);
  return expense;
}

export async function updateExpense(
  expenseId: string,
  tripId: string,
  data: { label: string; amount: number; category: string; eventId?: string }
) {
  const dbUser = await getDbUser();
  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = updateExpenseSchema.parse(data);

  const patch: {
    label: string;
    amount: number;
    category: string;
    eventId?: string | null;
  } = {
    label: validated.label,
    amount: validated.amount,
    category: validated.category,
  };

  if (validated.eventId !== undefined) {
    const eventId = validated.eventId || null;
    await assertEventOnTrip(eventId, tripId);
    patch.eventId = eventId;
  }

  // Scope to the trip so an expense id from another trip can't be edited.
  await db.expense.updateMany({
    where: { id: expenseId, tripId },
    data: patch,
  });
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function deleteExpense(expenseId: string, tripId: string) {
  const dbUser = await getDbUser();
  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  // Scope to the trip so an expense id from another trip can't be deleted.
  await db.expense.deleteMany({ where: { id: expenseId, tripId } });
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function updateTripBudget(tripId: string, totalBudget: number) {
  const dbUser = await getDbUser();
  // Any editor+ can adjust the budget ceiling (consistent with expense
  // editing), not just the owner.
  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = updateBudgetSchema.parse({ tripId, totalBudget });

  await db.trip.update({ where: { id: tripId }, data: { totalBudget: validated.totalBudget } });
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function updateSplitWeights(data: UpdateSplitInput) {
  const dbUser = await getDbUser();
  await assertTripRole(data.tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = updateSplitSchema.parse(data);

  // Only update members that actually belong to this trip.
  const memberIds = new Set(
    (await db.tripMember.findMany({ where: { tripId: validated.tripId }, select: { id: true } })).map((m) => m.id)
  );

  await db.$transaction(
    validated.weights
      .filter((w) => memberIds.has(w.memberId))
      .map((w) =>
        db.tripMember.update({ where: { id: w.memberId }, data: { splitWeight: w.weight } })
      )
  );

  revalidatePath(`/trips/${validated.tripId}/budget`);
}
