import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { sortEventsByTime } from "@/lib/sortEvents";
import { formatMoney } from "@/lib/money";
import { formatDate, formatShortDate, formatTime } from "@/lib/utils";
import { CATEGORIES, CAT_LABEL } from "@/components/budget/categories";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { PrintButton } from "@/components/itinerary/PrintButton";
import type { EventTypeKey } from "@/components/shared/Icons";
import { notFound } from "next/navigation";

export const metadata = { title: "Print itinerary" };

/**
 * Paper-first, ink-on-cream printable itinerary (ODY-032) — the "printed map"
 * moment the brand is named for. Server-rendered, members-only via
 * getTripById; day-by-day plan + a budget summary. Reuses existing trip data
 * plus one grouped spend query; the workspace chrome and toolbar are hidden
 * under `@media print`.
 */
export default async function PrintPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const spendRows = await db.expense.groupBy({
    by: ["category"],
    where: { tripId },
    _sum: { amount: true },
  });
  const byCat = new Map(spendRows.map((r) => [r.category, r._sum.amount ?? 0]));
  const grand = spendRows.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  const currency = trip.currency ?? "USD";
  const tf = (trip.timeFormat as "12h" | "24h") ?? "12h";

  return (
    <div className="canvas print-page">
      <div className="print-toolbar">
        <PrintButton />
      </div>

      <article className="print-sheet">
        <header className="print-head">
          <h1>{trip.title}</h1>
          <p className="print-meta">
            {trip.destination} · {formatShortDate(trip.startDate)} – {formatShortDate(trip.endDate)}
          </p>
        </header>

        {trip.days.map((day: (typeof trip.days)[number], i: number) => {
          const events = sortEventsByTime(day.events);
          return (
            <section className="print-day" key={day.id}>
              <h2>
                Day {String(i + 1).padStart(2, "0")}
                <span className="print-day-date"> · {formatDate(day.date)}</span>
              </h2>
              {events.length === 0 ? (
                <p className="print-empty">No plans yet.</p>
              ) : (
                <ul className="print-events">
                  {events.map((e) => (
                    <li key={e.id} className="print-event">
                      <span className="print-time">{e.startTime ? formatTime(e.startTime, tf) : "—"}</span>
                      <span className="print-event-body">
                        <span className="print-event-head">
                          <TypeBadge type={e.type as EventTypeKey} />
                          <strong>{e.title}</strong>
                        </span>
                        {e.location && <span className="print-loc">{e.location}</span>}
                        {e.notes && <span className="print-note">{e.notes}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {grand > 0 && (
          <section className="print-budget">
            <h2>Budget</h2>
            <ul className="print-budget-list">
              {CATEGORIES.filter((c) => (byCat.get(c) ?? 0) > 0).map((c) => (
                <li key={c}>
                  <span>{CAT_LABEL[c]}</span>
                  <span>{formatMoney(byCat.get(c) ?? 0, currency)}</span>
                </li>
              ))}
              <li className="print-budget-total">
                <span>Total</span>
                <span>{formatMoney(grand, currency)}</span>
              </li>
            </ul>
          </section>
        )}

        <footer className="print-foot">Made with Odyssey</footer>
      </article>
    </div>
  );
}
