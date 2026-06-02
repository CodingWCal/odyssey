import { getTripById } from "@/app/trips/actions";
import { MapClient } from "@/components/map/MapClient";
import { notFound } from "next/navigation";
import type { MapDay, MapEvent } from "@/components/map/mapTypes";
import type { EventType } from "@/types";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function MapPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const dateRange = `${new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Build day-grouped events with a running global index across all geocoded
  // events, in itinerary order (day date → event orderIndex).
  let globalIdx = 0;
  const days: MapDay[] = [];
  const allEvents: MapEvent[] = [];

  trip.days.forEach((d: (typeof trip.days)[number], di: number) => {
    const dayLabel = `Day ${String(di + 1).padStart(2, "0")}`;
    const dayDate = new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dayEvents: MapEvent[] = [];
    d.events.forEach((e: (typeof d.events)[number]) => {
      if (e.lat == null || e.lng == null) return;
      globalIdx += 1;
      const me: MapEvent = {
        id: e.id,
        type: e.type as EventType,
        title: e.title,
        location: e.location,
        startTime: e.startTime,
        endTime: e.endTime,
        cost: e.cost,
        notes: e.notes,
        lat: e.lat,
        lng: e.lng,
        dayId: d.id,
        dayLabel,
        dayDate,
        globalIdx,
      };
      dayEvents.push(me);
      allEvents.push(me);
    });
    if (dayEvents.length > 0) {
      days.push({ id: d.id, label: dayLabel, dateShort: dayDate, events: dayEvents });
    }
  });

  return (
    <MapClient
      days={days}
      events={allEvents}
      eyebrow={`${trip.destination} · ${dateRange}`}
      dayCount={trip.days.length}
    />
  );
}
