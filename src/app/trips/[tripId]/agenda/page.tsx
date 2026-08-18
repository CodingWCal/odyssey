import { getTripById } from "@/app/trips/actions";
import { DayAgenda, type AgendaEvent } from "@/components/itinerary/DayAgenda";
import { sortEventsByTime } from "@/lib/sortEvents";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ day?: string }>;
}

/** Default to the day the traveler is *in* on a live trip (ODY-076/087), else
 * the first day. `?day=` overrides. */
function defaultDayId(days: { id: string; date: Date }[], now: Date): string | null {
  if (days.length === 0) return null;
  const todayKey = now.toISOString().slice(0, 10);
  const today = days.find((d) => new Date(d.date).toISOString().slice(0, 10) === todayKey);
  return (today ?? days[0]).id;
}

export const metadata = { title: "Day agenda" };

export default async function AgendaPage({ params, searchParams }: Props) {
  const { tripId } = await params;
  const { day } = await searchParams;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const days = trip.days.map((d: (typeof trip.days)[number], i: number) => ({
    id: d.id,
    date: d.date,
    label: `Day ${String(i + 1).padStart(2, "0")}`,
  }));

  const selectedDayId = day && days.some((d) => d.id === day) ? day : defaultDayId(days, new Date());
  const selectedDay = trip.days.find((d: (typeof trip.days)[number]) => d.id === selectedDayId) ?? trip.days[0];
  const events: AgendaEvent[] = selectedDay ? sortEventsByTime(selectedDay.events) : [];

  return (
    <div className="canvas">
      <DayAgenda
        tripId={tripId}
        days={days}
        selectedDayId={selectedDayId}
        events={events}
        timeFormat={(trip.timeFormat as "12h" | "24h") ?? "12h"}
      />
    </div>
  );
}
