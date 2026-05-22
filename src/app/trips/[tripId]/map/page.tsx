import { getTripById } from "@/app/trips/actions";
import { MapClient } from "@/components/map/MapClient";
import { notFound } from "next/navigation";
import type { TripEvent } from "@/types";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function MapPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const events: TripEvent[] = trip.days
    .flatMap((d: (typeof trip.days)[number]) => d.events)
    .filter((e: (typeof trip.days)[number]["events"][number]) => e.lat != null && e.lng != null) as TripEvent[];

  return (
    <div className="h-screen md:h-[calc(100vh)] p-4 md:pb-4 pb-20">
      <div className="h-full rounded-2xl overflow-hidden shadow-sm">
        {events.length === 0 ? (
          <div className="h-full bg-odyssey-cream/30 rounded-2xl flex flex-col items-center justify-center text-center p-8">
            <p className="text-4xl mb-3" aria-hidden="true">🗺️</p>
            <h3 className="font-heading text-xl text-odyssey-ink mb-2">No pins yet</h3>
            <p className="text-odyssey-slate text-sm">
              Add latitude and longitude to events in the itinerary to see them here.
            </p>
          </div>
        ) : (
          <MapClient events={events} />
        )}
      </div>
    </div>
  );
}
