import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { ExpenseForm } from "@/components/budget/ExpenseForm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { deleteExpense } from "./actions";
import type { ExpenseCategory } from "@/types";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  flights:    "var(--coral)",
  lodging:    "var(--gold)",
  food:       "var(--peach)",
  transport:  "var(--peri)",
  activities: "var(--teal)",
  misc:       "var(--slate)",
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  flights: "Flights",
  lodging: "Lodging",
  food: "Food",
  transport: "Transport",
  activities: "Activities",
  misc: "Misc",
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
  const pct = trip.totalBudget && trip.totalBudget > 0
    ? Math.min(100, (totalSpent / trip.totalBudget) * 100)
    : 0;

  const byCategory = expenses.reduce((acc: Record<string, E[]>, exp: E) => {
    if (!acc[exp.category]) acc[exp.category] = [];
    acc[exp.category].push(exp);
    return acc;
  }, {} as Record<string, E[]>);

  return (
    <div className="canvas" style={{ maxWidth: 680 }}>
      {/* Hero */}
      <div className="trip-hero" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: .95, color: "white" }}>
            {formatCurrency(totalSpent)}
          </span>
          {trip.totalBudget && (
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22, color: "rgba(255,255,255,.7)" }}>
              of {formatCurrency(trip.totalBudget)}
            </span>
          )}
        </div>
        {trip.totalBudget && (
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden", marginBottom: 10 }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: "linear-gradient(90deg, #FFD9B8 0%, #F5B596 60%, #E68A6D 100%)",
              borderRadius: 999, transition: "width .8s ease",
            }} />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "rgba(255,255,255,.8)" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {remaining >= 0 ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(Math.abs(remaining))} over budget`}
          </span>
          {memberCount > 1 && totalSpent > 0 && (
            <span>≈ {formatCurrency(totalSpent / memberCount)} per person</span>
          )}
        </div>
      </div>

      {/* Add expense button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <Sheet>
          <SheetTrigger render={
            <button className="od-btn od-btn-cta" />
          }>
            + Add Expense
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Add Expense</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ExpenseForm tripId={tripId} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {expenses.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          background: "var(--paper-2)", borderRadius: "var(--radius-xl)",
          border: "1px solid var(--rule)",
        }}>
          <p style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">💰</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", margin: "0 0 6px" }}>
            No expenses yet.
          </p>
          <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>Add your first one above.</p>
        </div>
      ) : (
        <div>
          {Object.entries(byCategory).map(([category, catExpenses]) => {
            const catTotal = catExpenses.reduce((s: number, e: E) => s + e.amount, 0);
            const catColor = CATEGORY_COLORS[category as ExpenseCategory] ?? "var(--slate)";
            const catLabel = CATEGORY_LABELS[category as ExpenseCategory] ?? category;

            return (
              <div key={category} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 11,
                      background: `color-mix(in srgb, ${catColor} 12%, transparent)`,
                      color: catColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16,
                    }}>
                      ●
                    </div>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0, color: "var(--ink)" }}>
                      {catLabel}
                    </h3>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--ink)", fontWeight: 600 }}>
                    {formatCurrency(catTotal)}
                  </span>
                </div>

                <div style={{ borderLeft: `1px solid rgba(31,34,56,.12)`, marginLeft: 56, paddingLeft: 22 }}>
                  {catExpenses.map((exp: E) => (
                    <div
                      key={exp.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "12px 16px", marginBottom: 8,
                        background: "var(--paper-2)", border: "1px solid var(--rule)",
                        borderRadius: "var(--radius-md)",
                        position: "relative",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14, color: "var(--ink)" }}>{exp.label}</span>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                        {formatCurrency(exp.amount)}
                      </span>
                      <form action={deleteExpense.bind(null, exp.id, tripId)}>
                        <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0" style={{ color: "var(--ink-3)" }} aria-label="Delete expense">
                          ×
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
