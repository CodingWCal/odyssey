import { notFound } from "next/navigation";
import { getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/prisma/db";
import { PackingClient } from "@/components/packing/PackingClient";
import { visiblePackingWhere } from "@/lib/packing";
import { normalizeTripNoteContent } from "@/lib/tripNotes";

type PackingItem = {
  id: string;
  label: string;
  done: boolean;
  ownerId: string | null;
  assigneeId: string | null;
  eventId: string | null;
  event: { id: string; title: string; orderIndex: number; day: { date: Date } } | null;
};
type TripMember = { userId: string; role: string; user: { id: string; name: string } };
type TripPackingData = { items: PackingItem[]; members: TripMember[]; noteContent: unknown };

/**
 * Data-only (no JSX) so a query failure can be caught and retried without
 * tripping the `react-hooks/error-boundaries` lint rule, and so `notFound()`
 * (which itself throws) stays outside any try/catch here.
 */
async function loadTrip(tripId: string, userId: string): Promise<TripPackingData | null> {
  const tripQuery = { where: { id: tripId, members: { some: { userId } } } } as const;
  const memberInclude = { include: { user: { select: { id: true, name: true } } } } as const;

  try {
    const trip = await db.trip.findFirst({
      ...tripQuery,
      include: {
        members: memberInclude,
        note: true,
        checklistItems: {
          where: visiblePackingWhere(tripId, userId),
          orderBy: [{ ownerId: "asc" }, { orderIndex: "asc" }],
          // ODY-067 Stage B: event + its day, so event-scoped items can roll
          // up under "By activity" instead of cluttering the flat personal list.
          include: { event: { select: { id: true, title: true, orderIndex: true, day: { select: { date: true } } } } },
        },
      },
    });
    if (!trip) return null;
    return { items: trip.checklistItems, members: trip.members, noteContent: trip.note?.content };
  } catch (err) {
    // Defensive: ChecklistItem.eventId + its relation only exist once
    // `prisma db push` has run against this database (see BACKLOG.md's
    // required-deploy-step warning). Fall back to a query that doesn't
    // select that column at all — group/personal lists still work, just
    // without the "By activity" rollup — instead of taking down the whole
    // Packing page (same failure shape the itinerary page hit).
    console.error("[packing] event-relation query failed (has `prisma db push` run?):", err);
    const trip = await db.trip.findFirst({
      ...tripQuery,
      include: {
        members: memberInclude,
        note: true,
        checklistItems: {
          where: visiblePackingWhere(tripId, userId),
          orderBy: [{ ownerId: "asc" }, { orderIndex: "asc" }],
          select: { id: true, label: true, done: true, ownerId: true, assigneeId: true },
        },
      },
    });
    if (!trip) return null;
    return {
      items: trip.checklistItems.map((i) => ({ ...i, eventId: null, event: null })),
      members: trip.members,
      noteContent: trip.note?.content,
    };
  }
}

export default async function PackingPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getOrCreateDbUser();
  const data = await loadTrip(tripId, user.id);
  if (!data) notFound();

  const hasLegacyPacking = normalizeTripNoteContent(data.noteContent).sections.some((s) => s.title === "Packing List" && s.text.trim());
  return (
    <div className="canvas">
      <PackingClient
        tripId={tripId}
        items={data.items}
        members={data.members.map((m) => ({ id: m.user.id, name: m.user.name }))}
        hasLegacyPacking={hasLegacyPacking}
        readOnly={data.members.find((m) => m.userId === user.id)?.role === "viewer"}
      />
    </div>
  );
}
