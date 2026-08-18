"use server";

import { db } from "@/lib/prisma/db";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
import { normalizeTripNoteContent } from "@/lib/tripNotes";
import { isSearchable, searchNoteSections } from "@/lib/tripSearch";

export type TripSearchKind = "event" | "place" | "note";

export interface TripSearchResult {
  kind: TripSearchKind;
  id: string;
  title: string;
  /** Location / day / snippet — secondary context under the title. */
  subtitle: string;
  /** Which trip tab to jump to on select. Notes live on the itinerary now
   * (ODY-060), so note matches route there too. */
  tab: "itinerary" | "collections";
}

const PER_KIND_CAP = 8;
const TOTAL_CAP = 24;

function dayLabel(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Search within a single trip across events, saved places, and note sections
 * (ODY-083). Any member can search (viewer+); results are scoped to the trip
 * server-side. Events/places match via case-insensitive `contains`; notes are
 * matched in JS over the sections JSON.
 */
export async function searchTrip(tripId: string, rawQuery: string): Promise<TripSearchResult[]> {
  const dbUser = await getOrCreateDbUser();
  await assertTripRole(tripId, dbUser.id, "viewer");

  const q = rawQuery.trim();
  if (!isSearchable(q)) return [];

  const contains = { contains: q, mode: "insensitive" as const };

  const [events, places, note] = await Promise.all([
    db.event.findMany({
      where: { tripId, OR: [{ title: contains }, { location: contains }, { notes: contains }] },
      select: { id: true, title: true, location: true, day: { select: { date: true } } },
      take: PER_KIND_CAP,
    }),
    db.place.findMany({
      where: { tripId, OR: [{ title: contains }, { location: contains }, { notes: contains }] },
      select: { id: true, title: true, location: true },
      take: PER_KIND_CAP,
    }),
    db.note.findUnique({ where: { tripId }, select: { content: true } }),
  ]);

  const results: TripSearchResult[] = [];

  for (const e of events) {
    const bits = [e.location, dayLabel(e.day?.date)].filter(Boolean);
    results.push({ kind: "event", id: e.id, title: e.title, subtitle: bits.join(" · "), tab: "itinerary" });
  }
  for (const p of places) {
    results.push({ kind: "place", id: p.id, title: p.title, subtitle: p.location ?? "Saved place", tab: "collections" });
  }
  if (note) {
    const sections = normalizeTripNoteContent(note.content).sections;
    for (const m of searchNoteSections(sections, q)) {
      results.push({ kind: "note", id: m.id, title: m.title, subtitle: m.snippet, tab: "itinerary" });
    }
  }

  return results.slice(0, TOTAL_CAP);
}
