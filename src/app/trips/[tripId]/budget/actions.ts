"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import {
  createExpenseSchema,
  updateExpenseSchema,
  updateSplitSchema,
  updateBudgetSchema,
  recordSettlementSchema,
  type UpdateSplitInput,
  type RecordSettlementInput,
} from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
import { weightedSharesCents } from "@/lib/budget";

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

/** Current trip members, for validating paidBy/shares reference real travelers (ODY-094). */
async function tripMemberWeights(tripId: string): Promise<{ userId: string; weight: number }[]> {
  const members = await db.tripMember.findMany({ where: { tripId }, select: { userId: true, splitWeight: true } });
  return members.map((m: (typeof members)[number]) => ({ userId: m.userId, weight: m.splitWeight }));
}

type ExpenseShareInput = { userId: string; amountCents: number };

/** Default shares for a fresh, uncustomized expense: everyone on the trip,
 * weighted per the trip's existing splitWeight settings (ODY-094) — keeps
 * "equal split is one-tap" true; identical dollar outcome to the old
 * trip-wide split for anyone who doesn't touch the new controls. */
function defaultShares(members: { userId: string; weight: number }[], amount: number): ExpenseShareInput[] {
  return weightedSharesCents(members, Math.round(amount * 100));
}

/** Reject shares referencing a non-member (IDOR-style guard, ODY-094). */
function assertSharesAreMembers(shares: ExpenseShareInput[], memberUserIds: Set<string>) {
  if (shares.some((s) => !memberUserIds.has(s.userId))) {
    throw new Error("Split includes someone no longer on this trip");
  }
}

export async function createExpense(data: {
  tripId: string;
  eventId?: string;
  label: string;
  amount: number;
  category: string;
  paidBy?: string;
  splitMode?: "equal" | "exact";
  shares?: ExpenseShareInput[];
}) {
  const dbUser = await getDbUser();
  await assertTripRole(data.tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = createExpenseSchema.parse(data);
  const eventId = validated.eventId || null;
  await assertEventOnTrip(eventId, validated.tripId);

  const members = await tripMemberWeights(validated.tripId);
  const memberUserIds = new Set(members.map((m) => m.userId));

  const paidBy = validated.paidBy && memberUserIds.has(validated.paidBy) ? validated.paidBy : dbUser.id;
  const shares = validated.shares ?? defaultShares(members, validated.amount);
  assertSharesAreMembers(shares, memberUserIds);

  const expense = await db.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        tripId: validated.tripId,
        eventId,
        label: validated.label,
        amount: validated.amount,
        category: validated.category,
        addedBy: dbUser.id,
        paidBy,
        splitMode: validated.splitMode ?? "equal",
      },
    });
    await tx.expenseShare.createMany({
      data: shares.map((s) => ({ expenseId: created.id, userId: s.userId, amountCents: s.amountCents })),
    });
    return created;
  });

  revalidatePath(`/trips/${validated.tripId}/budget`);
  return expense;
}

export async function updateExpense(
  expenseId: string,
  tripId: string,
  data: {
    label: string;
    amount: number;
    category: string;
    eventId?: string;
    paidBy?: string;
    splitMode?: "equal" | "exact";
    shares?: ExpenseShareInput[];
  }
) {
  const dbUser = await getDbUser();
  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = updateExpenseSchema.parse(data);

  const patch: {
    label: string;
    amount: number;
    category: string;
    eventId?: string | null;
    paidBy?: string;
    splitMode?: string;
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

  const shares: ExpenseShareInput[] | undefined = validated.shares;
  if (validated.paidBy || shares) {
    const members = await tripMemberWeights(tripId);
    const memberUserIds = new Set(members.map((m) => m.userId));
    if (validated.paidBy && memberUserIds.has(validated.paidBy)) patch.paidBy = validated.paidBy;
    if (shares) assertSharesAreMembers(shares, memberUserIds);
  }
  if (validated.splitMode) patch.splitMode = validated.splitMode;

  // Scope to the trip so an expense id from another trip can't be edited —
  // including the ExpenseShare replace, which has no tripId of its own.
  await db.$transaction(async (tx) => {
    const { count } = await tx.expense.updateMany({ where: { id: expenseId, tripId }, data: patch });
    if (shares && count > 0) {
      await tx.expenseShare.deleteMany({ where: { expenseId, expense: { tripId } } });
      await tx.expenseShare.createMany({
        data: shares.map((s) => ({ expenseId, userId: s.userId, amountCents: s.amountCents })),
      });
    }
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

/** Record a settle-up payment made outside the expense ledger (ODY-107),
 * e.g. "Sam Venmo'd Alex $30" — offsets balances without touching expenses. */
export async function recordSettlement(data: RecordSettlementInput) {
  const dbUser = await getDbUser();
  await assertTripRole(data.tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = recordSettlementSchema.parse(data);

  const memberIds = new Set(
    (await db.tripMember.findMany({ where: { tripId: validated.tripId }, select: { userId: true } })).map(
      (m: { userId: string }) => m.userId
    )
  );
  if (!memberIds.has(validated.fromUserId) || !memberIds.has(validated.toUserId)) {
    throw new Error("Not found");
  }

  await db.settlement.create({
    data: {
      tripId: validated.tripId,
      fromUserId: validated.fromUserId,
      toUserId: validated.toUserId,
      amountCents: validated.amountCents,
      note: validated.note,
      createdBy: dbUser.id,
    },
  });

  revalidatePath(`/trips/${validated.tripId}/budget`);
}

export async function deleteSettlement(settlementId: string, tripId: string) {
  const dbUser = await getDbUser();
  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  // Scope to the trip so a settlement id from another trip can't be deleted.
  await db.settlement.deleteMany({ where: { id: settlementId, tripId } });
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
