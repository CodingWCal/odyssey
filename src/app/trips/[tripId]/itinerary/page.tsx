import { getTripById } from "@/app/trips/actions";
import { DayBlock } from "@/components/itinerary/DayBlock";
import { WeatherBanner, fetchWeather } from "@/components/shared/WeatherBanner";
import { notFound } from "next/navigation";
import type { TripDay } from "@/types";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function ItineraryPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const weather = await fetchWeather(trip.destination, trip.startDate);

  return (
    <div className="px-6 py-8 md:pb-8 pb-24 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-odyssey-ink">{trip.title}</h1>
        <p className="text-odyssey-slate text-sm mt-1">📍 {trip.destination}</p>
      </div>

      <WeatherBanner weather={weather} destination={trip.destination} />

      {trip.days.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-odyssey-cream">
          <p className="text-3xl mb-3" aria-hidden="true">🗓</p>
          <p className="text-odyssey-slate">No days found for this trip. Check your trip dates.</p>
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
