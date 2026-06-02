import { getTripById } from "@/app/trips/actions";
import { DayBlock } from "@/components/itinerary/DayBlock";
import { TripNotes } from "@/components/itinerary/TripNotes";
import { fetchWeather } from "@/components/shared/WeatherBanner";
import { AvatarStack } from "@/components/shared/AvatarStack";
import { Icons } from "@/components/shared/Icons";
import { notFound } from "next/navigation";
import type { TripDay } from "@/types";
import { formatShortDate } from "@/lib/utils";

interface Props {
  params: Promise<{ tripId: string }>;
}

const CONDITION_ICONS: Record<string, string> = {
  clear: "☀️", cloudy: "⛅", rain: "🌧", snow: "❄️",
  storm: "⛈", fog: "🌫", wind: "💨", default: "🌤",
};

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

  return (
    <div className="canvas">
      <section className="hero" aria-label="Trip overview">
        <div className="hero-top">
          <div className="left">
            <div className="hero-eyebrow">{trip.destination} · {dateRange}</div>
            <h1 className="hero-title">{head}<em>{tail}</em></h1>
          </div>
          {members.length > 0 && (
            <div className="hero-people" title="Collaborators">
              <AvatarStack members={members} />
              <span>{members.length} traveler{members.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        <div className="hero-row">
          {weather && (
            <>
              <span className="hero-weather">
                <span>{CONDITION_ICONS[weather.condition] ?? CONDITION_ICONS.default}</span>
                <span className="temp">{Math.round(weather.temperature)}°F</span>
                <span style={{ opacity: 0.8 }}>· {weather.condition}</span>
              </span>
              <span className="dot" />
            </>
          )}
          <span><strong>{trip.days.length} days</strong></span>
          <span className="dot" />
          <span>{totalEvents} planned events</span>
          <span className="dot" />
          <span><Icons.pin size={12} /> {trip.destination}</span>
        </div>
      </section>

      <TripNotes tripId={tripId} initialText={noteText} />

      {trip.days.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", background: "var(--paper-2)", borderRadius: "var(--radius-xl)", border: "1px solid var(--rule)" }}>
          <p style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">🗓</p>
          <p style={{ color: "var(--ink-2)", fontFamily: "var(--font-display)", fontSize: 22 }}>No days found for this trip.</p>
          <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 6 }}>Check your trip dates in settings.</p>
        </div>
      ) : (
        trip.days.map((day: (typeof trip.days)[number], index: number) => (
          <DayBlock key={day.id} day={day as TripDay} tripId={tripId} dayNumber={index + 1} />
        ))
      )}
    </div>
  );
}
