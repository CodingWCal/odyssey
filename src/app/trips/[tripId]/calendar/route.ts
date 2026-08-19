import { getTripById } from "@/app/trips/actions";
import { buildTripIcs, icsFilename, type IcsEvent } from "@/lib/icsExport";

/**
 * Read-only calendar export (ODY-069): `GET /trips/[tripId]/calendar` returns
 * the trip's itinerary as an .ics download. Membership is enforced by
 * getTripById (returns null for non-members → 404), so this is members-only.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) return new Response("Not found", { status: 404 });

  // Flatten day-scoped events, carrying each day's date onto the event so the
  // ICS builder can place it on the right calendar day.
  const events: IcsEvent[] = trip.days.flatMap((d) =>
    d.events.map((e) => ({
      id: e.id,
      title: e.title,
      location: e.location,
      notes: e.notes,
      startTime: e.startTime,
      endTime: e.endTime,
      date: d.date,
    }))
  );

  const ics = buildTripIcs({ title: trip.title, destination: trip.destination, events });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(trip.title)}"`,
      "Cache-Control": "no-store",
    },
  });
}
