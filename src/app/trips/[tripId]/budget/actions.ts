"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { createExpenseSchema } from "@/lib/validations";

async function getDbUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  let dbUser = await db.user.findUnique({ where: { clerkId: user.id } });
  if (!dbUser) {
    dbUser = await db.user.create({
      data: {
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Traveler",
        avatarUrl: user.imageUrl ?? null,
      },
    });
  }
  return dbUser;
}

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

export async function deleteExpense(expenseId: string, tripId: string) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");

  await db.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/trips/${tripId}/budget`);
}

export async function updateTripBudget(tripId: string, totalBudget: number) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id, role: "owner" } });
  if (!member) throw new Error("Unauthorized");

  await db.trip.update({ where: { id: tripId }, data: { totalBudget } });
  revalidatePath(`/trips/${tripId}/budget`);
}
