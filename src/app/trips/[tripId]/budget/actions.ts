"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { createExpenseSchema, updateSplitSchema, updateBudgetSchema, type UpdateSplitInput } from "@/lib/validations";
import { getOrCreateDbUser } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

export async function createExpense(data: {
  tripId: string;
  eventId?: string;
  label: string;
  amount: number;
  category: string;
}) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({ where: { tripId: data.tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");

  const validated = createExpenseSchema.parse(data);

  const expense = await db.expense.create({
    data: {
      tripId: validated.tripId,
      eventId: validated.eventId || null,
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
  data: { label: string; amount: number; category: string }
) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");

  // Scope to the trip so an expense id from another trip can't be edited.
  await db.expense.updateMany({
    where: { id: expenseId, tripId },
    data: { label: data.label, amount: data.amount, category: data.category },
  });
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function deleteExpense(expenseId: string, tripId: string) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");

  // Scope to the trip so an expense id from another trip can't be deleted.
  await db.expense.deleteMany({ where: { id: expenseId, tripId } });
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function updateTripBudget(tripId: string, totalBudget: number) {
  const dbUser = await getDbUser();
  // Any trip member can adjust the budget ceiling at any point (consistent with
  // expense editing), not just the owner.
  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");

  const validated = updateBudgetSchema.parse({ tripId, totalBudget });

  await db.trip.update({ where: { id: tripId }, data: { totalBudget: validated.totalBudget } });
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function updateSplitWeights(data: UpdateSplitInput) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({ where: { tripId: data.tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");

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
