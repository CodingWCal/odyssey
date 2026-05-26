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
    <div style={{ height: "100vh", padding: "16px", paddingBottom: "16px" }}>
      <div style={{ height: "100%", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-2)" }}>
        {events.length === 0 ? (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "var(--paper-3)", textAlign: "center", padding: 32,
          }}>
            <p style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🗺️</p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: "0 0 8px", color: "var(--ink)" }}>
              No pins <em style={{ fontStyle: "italic", color: "var(--peri)" }}>yet</em>
            </h3>
            <p style={{ color: "var(--ink-2)", fontSize: 14, maxWidth: 340, margin: 0 }}>
              Add an address to events in the itinerary and click "📍 Pin" — they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <MapClient events={events} />
        )}
      </div>
    </div>
  );
}
