import { getTripById } from "@/app/trips/actions";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { splitDestinations } from "@/lib/destinations";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function ExplorePage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const days = trip.days.map((d: (typeof trip.days)[number], i: number) => ({
    id: d.id,
    label: `Day ${String(i + 1).padStart(2, "0")}`,
    date: d.date,
  }));

  return (
    <div className="canvas">
      <ExploreClient
        tripId={tripId}
        destination={trip.destination}
        destinations={splitDestinations(trip.destination)}
        days={days}
        readOnly={trip.myRole === "viewer"}
      />
    </div>
  );
}
