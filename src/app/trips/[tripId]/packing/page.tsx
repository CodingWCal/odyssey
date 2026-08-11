import { notFound } from "next/navigation";
import { getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/prisma/db";
import { PackingClient } from "@/components/packing/PackingClient";
import { visiblePackingWhere } from "@/lib/packing";
import { normalizeTripNoteContent } from "@/lib/tripNotes";

export default async function PackingPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getOrCreateDbUser();
  const trip = await db.trip.findFirst({ where: { id: tripId, members: { some: { userId: user.id } } }, include: { members: { include: { user: { select: { id: true, name: true } } } }, note: true, checklistItems: { where: visiblePackingWhere(tripId, user.id), orderBy: [{ ownerId: "asc" }, { orderIndex: "asc" }] } } });
  if (!trip) notFound();
  const hasLegacyPacking = normalizeTripNoteContent(trip.note?.content).sections.some((s) => s.title === "Packing List" && s.text.trim());
  return <div className="canvas"><PackingClient tripId={tripId} items={trip.checklistItems} members={trip.members.map((m) => ({ id: m.user.id, name: m.user.name }))} hasLegacyPacking={hasLegacyPacking} readOnly={trip.members.find((m) => m.userId === user.id)?.role === "viewer"} /></div>;
}
