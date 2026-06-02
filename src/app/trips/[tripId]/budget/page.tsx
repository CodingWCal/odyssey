import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { BudgetClient, type BudgetExpense } from "@/components/budget/BudgetClient";
import type { Category } from "@/components/budget/categories";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function BudgetPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const rows = await db.expense.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      event: { select: { title: true } },
    },
  });

  const expenses: BudgetExpense[] = rows.map((e: (typeof rows)[number]) => ({
    id: e.id,
    label: e.label,
    amount: e.amount,
    category: e.category as Category,
    who: e.user?.name ?? "Someone",
    eventTitle: e.event?.title ?? null,
  }));

  const dateRange = `${new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const members = trip.members.map((m: (typeof trip.members)[number]) => ({ id: m.id, name: m.user?.name ?? "Traveler" }));

  return (
    <BudgetClient
      tripId={tripId}
      totalBudget={trip.totalBudget}
      eyebrow={`${trip.destination} · ${dateRange}`}
      members={members}
      expenses={expenses}
    />
  );
}
