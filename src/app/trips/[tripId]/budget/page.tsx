import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { BudgetClient, type BudgetExpense } from "@/components/budget/BudgetClient";
import type { Category } from "@/components/budget/categories";
import { notFound } from "next/navigation";
import { aggregateBalances, weightedSharesCents, type ResolvedExpenseForBalances } from "@/lib/budget";
import { getOrCreateDbUser } from "@/lib/auth";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function BudgetPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();
  const dbUser = await getOrCreateDbUser();

  const rows = await db.expense.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      payer: { select: { name: true } },
      event: { select: { title: true } },
      shares: { select: { userId: true, amountCents: true } },
    },
  });

  const settlementRows = await db.settlement.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  });

  const dateRange = `${new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  const members = trip.members.map((m: (typeof trip.members)[number]) => ({ id: m.id, name: m.user?.name ?? "Traveler" }));
  const memberWeights = trip.members.map((m: (typeof trip.members)[number]) => ({ userId: m.userId, weight: m.splitWeight ?? 1 }));
  const memberUserIds = trip.members.map((m: (typeof trip.members)[number]) => m.userId);

  const expenses: BudgetExpense[] = rows.map((e: (typeof rows)[number]) => ({
    id: e.id,
    label: e.label,
    amount: e.amount,
    category: e.category as Category,
    who: e.payer?.name ?? e.user?.name ?? "Someone",
    eventTitle: e.event?.title ?? null,
    paidBy: e.paidBy ?? e.addedBy,
    splitMode: (e.splitMode === "exact" ? "exact" : "equal") as "equal" | "exact",
    shares: e.shares.map((s: (typeof e.shares)[number]) => ({ userId: s.userId, amountCents: s.amountCents })),
  }));

  // Real per-member balances aggregated across every expense's actual
  // participants (ODY-094 Stage B) — legacy expenses with no ExpenseShare
  // rows yet fall back to the trip-wide weighted split, same as before.
  const resolved: ResolvedExpenseForBalances[] = rows.map((e: (typeof rows)[number]) => ({
    amountCents: Math.round(e.amount * 100),
    paidByUserId: e.paidBy ?? e.addedBy,
    shares:
      e.shares.length > 0
        ? e.shares.map((s: (typeof e.shares)[number]) => ({ userId: s.userId, amountCents: s.amountCents }))
        : weightedSharesCents(memberWeights, Math.round(e.amount * 100)),
  }));
  const resolvedSettlements = settlementRows.map((s: (typeof settlementRows)[number]) => ({
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    amountCents: s.amountCents,
  }));
  const balances = aggregateBalances(memberUserIds, resolved, resolvedSettlements);
  const balanceByUserId = new Map(balances.map((b) => [b.userId, b]));

  const nameByUserId = new Map(trip.members.map((m: (typeof trip.members)[number]) => [m.userId, m.user?.name ?? "Traveler"]));
  const settlements = settlementRows.map((s: (typeof settlementRows)[number]) => ({
    id: s.id,
    fromUserId: s.fromUserId,
    fromName: nameByUserId.get(s.fromUserId) ?? "Traveler",
    toUserId: s.toUserId,
    toName: nameByUserId.get(s.toUserId) ?? "Traveler",
    amount: s.amountCents / 100,
    createdAt: s.createdAt.toISOString(),
  }));

  const splitMembers = trip.members.map((m: (typeof trip.members)[number]) => {
    const bal = balanceByUserId.get(m.userId);
    return {
      id: m.id,
      userId: m.userId,
      name: m.user?.name ?? "Traveler",
      weight: m.splitWeight ?? 1,
      paid: (bal?.paidCents ?? 0) / 100,
      owed: (bal?.owedCents ?? 0) / 100,
      balance: (bal?.balanceCents ?? 0) / 100,
    };
  });

  return (
    <BudgetClient
      tripId={tripId}
      totalBudget={trip.totalBudget}
      eyebrow={`${trip.destination} · ${dateRange}`}
      members={members}
      tripMembers={trip.members.map((m: (typeof trip.members)[number]) => ({ userId: m.userId, name: m.user?.name ?? "Traveler" }))}
      currentUserId={dbUser.id}
      splitMembers={splitMembers}
      expenses={expenses}
      settlements={settlements}
      readOnly={trip.myRole === "viewer"}
    />
  );
}
