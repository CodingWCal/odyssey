import { getTripById } from "@/app/trips/actions";
import { DayBlock } from "@/components/itinerary/DayBlock";
import { TripNotes } from "@/components/itinerary/TripNotes";
import { ItineraryHero } from "@/components/itinerary/ItineraryHero";
import { fetchWeather } from "@/components/shared/WeatherBanner";
import { notFound } from "next/navigation";
import type { TripDay } from "@/types";
import { formatShortDate } from "@/lib/utils";

interface Props {
  params: Promise<{ tripId: string }>;
}

/** Wrap the last word of a title in <em> for the editorial accent. */
function titleParts(title: string): { head: string; tail: string } {
  const m = title.match(/^(.*?)(\s+\S+)$/);
  if (!m) return { head: "", tail: title };
  return { head: m[1], tail: m[2] };
}

export default async function ItineraryPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const weather = await fetchWeather(trip.destination, trip.startDate);
  const totalEvents = trip.days.reduce((n: number, d: (typeof trip.days)[number]) => n + d.events.length, 0);
  const dateRange = `${formatShortDate(trip.startDate)} – ${formatShortDate(trip.endDate)}`;
  const members = trip.members.map((m: (typeof trip.members)[number]) => ({ id: m.id, name: m.user?.name ?? "Traveler" }));
  const { head, tail } = titleParts(trip.title);
  const noteContent = trip.note?.content as { text?: string } | null;
  const noteText = typeof noteContent?.text === "string" ? noteContent.text : "";
  const readOnly = trip.myRole === "viewer"; // ODY-001

  return (
    <div className="canvas">
      <ItineraryHero
        tripId={tripId}
        destination={trip.destination}
        dateRange={dateRange}
        title={trip.title}
        titleParts={{ head, tail }}
        members={members}
        weather={weather}
        totalDays={trip.days.length}
        totalEvents={totalEvents}
        trip={{ startDate: trip.startDate, endDate: trip.endDate }}
        canEdit={!readOnly}
      />

      <TripNotes tripId={tripId} initialText={noteText} readOnly={readOnly} />

      {trip.days.length === 0 ? (
        <div className="empty-card tall">
          <p className="glyph sm" aria-hidden="true">🗓</p>
          <p className="headline soft">No days found for this trip.</p>
          <p className="sub mt">Check your trip dates in settings.</p>
        </div>
      ) : (
        trip.days.map((day: (typeof trip.days)[number], index: number) => (
          <DayBlock key={day.id} day={day as TripDay} tripId={tripId} dayNumber={index + 1} readOnly={readOnly} />
        ))
      )}
    </div>
  );
}
