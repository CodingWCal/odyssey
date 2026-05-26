import { getTripById } from "@/app/trips/actions";
import { DayBlock } from "@/components/itinerary/DayBlock";
import { fetchWeather } from "@/components/shared/WeatherBanner";
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

export default async function ItineraryPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const weather = await fetchWeather(trip.destination, trip.startDate);

  const totalEvents = trip.days.reduce(
    (n: number, d: (typeof trip.days)[number]) => n + d.events.length,
    0
  );

  const dateRange = `${formatShortDate(trip.startDate)} – ${formatShortDate(trip.endDate)}`;

  return (
    <div className="canvas">
      {/* Hero */}
      <div className="trip-hero">
        <div className="trip-hero-top">
          <div className="left">
            <div className="trip-hero-eyebrow">
              {trip.destination} · {dateRange}
            </div>
            <h1 className="trip-hero-title">{trip.title}</h1>
          </div>
          {trip.members && trip.members.length > 0 && (
            <div className="trip-hero-people">
              <div className="od-avatar-stack">
                {trip.members.slice(0, 4).map((m: (typeof trip.members)[number]) => (
                  <span
                    key={m.id}
                    className="od-avatar sm"
                    style={{ background: "rgba(255,255,255,.25)", color: "white", fontSize: 10 }}
                    title={m.user?.name ?? "Member"}
                  >
                    {(m.user?.name ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                ))}
              </div>
              <span>{trip.members.length} traveler{trip.members.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        <div className="trip-hero-row">
          {weather && (
            <>
              <span className="trip-hero-weather">
                <span>{CONDITION_ICONS[weather.condition] ?? "🌤"}</span>
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
          <span>{trip.destination}</span>
        </div>
      </div>

      {/* Days */}
      {trip.days.length === 0 ? (
        <div
          style={{
            textAlign: "center", padding: "64px 24px",
            background: "var(--paper-2)", borderRadius: "var(--radius-xl)",
            border: "1px solid var(--rule)",
          }}
        >
          <p style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">🗓</p>
          <p style={{ color: "var(--ink-2)", fontFamily: "var(--font-display)", fontSize: 22 }}>
            No days found for this trip.
          </p>
          <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 6 }}>
            Check your trip dates in settings.
          </p>
        </div>
      ) : (
        trip.days.map((day: (typeof trip.days)[number], index: number) => (
          <DayBlock
            key={day.id}
            day={day as TripDay}
            tripId={tripId}
            dayNumber={index + 1}
          />
        ))
      )}
    </div>
  );
}
