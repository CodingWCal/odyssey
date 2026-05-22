import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function TripPage({ params }: Props) {
  const { tripId } = await params;
  redirect(`/trips/${tripId}/itinerary`);
}
