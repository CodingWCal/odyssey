import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { ExpenseForm } from "@/components/budget/ExpenseForm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { deleteExpense } from "./actions";
import type { ExpenseCategory } from "@/types";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  flights: "✈️ Flights",
  lodging: "🏨 Lodging",
  food: "🍽️ Food",
  transport: "🚗 Transport",
  activities: "🎯 Activities",
  misc: "📌 Misc",
};

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function BudgetPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const expenses = await db.expense.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  });

  type E = (typeof expenses)[number];

  const totalSpent = expenses.reduce((s: number, e: E) => s + e.amount, 0);
  const remaining = (trip.totalBudget ?? 0) - totalSpent;
  const memberCount = trip.members.length;

  const byCategory = expenses.reduce((acc: Record<string, E[]>, exp: E) => {
    if (!acc[exp.category]) acc[exp.category] = [];
    acc[exp.category].push(exp);
    return acc;
  }, {} as Record<string, E[]>);

  return (
    <div className="px-6 py-8 md:pb-8 pb-24 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl text-odyssey-ink">Budget</h1>
        <Sheet>
          <SheetTrigger render={<Button className="bg-odyssey-teal hover:bg-odyssey-teal/90 text-white rounded-xl text-sm" />}>
            + Add Expense
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="font-heading">Add Expense</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ExpenseForm tripId={tripId} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="bg-white rounded-2xl border border-odyssey-cream p-5 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-odyssey-slate mb-1">Budget</p>
            <p className="font-mono font-semibold text-odyssey-ink text-lg">
              {trip.totalBudget ? formatCurrency(trip.totalBudget) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-odyssey-slate mb-1">Spent</p>
            <p className="font-mono font-semibold text-odyssey-coral text-lg">{formatCurrency(totalSpent)}</p>
          </div>
          <div>
            <p className="text-xs text-odyssey-slate mb-1">Remaining</p>
            <p className={`font-mono font-semibold text-lg ${remaining >= 0 ? "text-odyssey-teal" : "text-odyssey-coral"}`}>
              {trip.totalBudget ? formatCurrency(remaining) : "—"}
            </p>
          </div>
        </div>
        {memberCount > 1 && totalSpent > 0 && (
          <div className="mt-4 pt-4 border-t border-odyssey-cream text-center">
            <p className="text-xs text-odyssey-slate">
              Per person ({memberCount} travelers):&nbsp;
              <span className="font-mono font-semibold text-odyssey-ink">{formatCurrency(totalSpent / memberCount)}</span>
            </p>
          </div>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-odyssey-cream">
          <p className="text-3xl mb-2" aria-hidden="true">💰</p>
          <p className="text-odyssey-slate text-sm">No expenses yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([category, catExpenses]) => (
            <div key={category} className="bg-white rounded-2xl border border-odyssey-cream overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-odyssey-mist border-b border-odyssey-cream">
                <h3 className="text-sm font-semibold text-odyssey-ink">
                  {CATEGORY_LABELS[category as ExpenseCategory] ?? category}
                </h3>
                <span className="font-mono text-sm text-odyssey-slate">
                  {formatCurrency(catExpenses.reduce((s: number, e: E) => s + e.amount, 0))}
                </span>
              </div>
              <div className="divide-y divide-odyssey-cream">
                {catExpenses.map((exp: E) => (
                  <div key={exp.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-odyssey-ink">{exp.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-odyssey-ink">{formatCurrency(exp.amount)}</span>
                      <form action={deleteExpense.bind(null, exp.id, tripId)}>
                        <Button type="submit" variant="ghost" size="sm" className="h-6 w-6 p-0 text-odyssey-slate/40 hover:text-odyssey-coral" aria-label="Delete expense">
                          ×
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
