import { getTripById } from "@/app/trips/actions";
import { listPlaces } from "@/app/trips/[tripId]/collections/actions";
import { CollectionsClient } from "@/components/collections/CollectionsClient";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function CollectionsPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const places = await listPlaces(tripId);
  const readOnly = trip.myRole === "viewer";

  const days = trip.days.map((d: (typeof trip.days)[number], i: number) => ({
    id: d.id,
    label: `Day ${String(i + 1).padStart(2, "0")}`,
    date: d.date,
  }));

  return (
    <div className="canvas">
      <CollectionsClient
        tripId={tripId}
        destination={trip.destination}
        days={days}
        places={places.map((p) => ({
          id: p.id,
          category: p.category,
          title: p.title,
          location: p.location,
          lat: p.lat,
          lng: p.lng,
          notes: p.notes,
          listName: p.listName,
        }))}
        readOnly={readOnly}
      />
    </div>
  );
}
