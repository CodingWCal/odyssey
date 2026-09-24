import { getTripById } from "@/app/trips/actions";
import { getNotesHintDismissed } from "@/app/trips/[tripId]/notes/actions";
import { DayBlock } from "@/components/itinerary/DayBlock";
import { TripNotes } from "@/components/itinerary/TripNotes";
import { FirstSteps } from "@/components/itinerary/FirstSteps";
import { ItineraryHero } from "@/components/itinerary/ItineraryHero";
import { JoinWelcome } from "@/components/trips/JoinWelcome";
import { fetchWeather } from "@/components/shared/WeatherBanner";
import { notFound } from "next/navigation";
import { ItineraryBoard } from "@/components/itinerary/ItineraryBoard";
import type { DayOption, TripDay, TripEvent, FlightLeg } from "@/types";
import { formatShortDate } from "@/lib/utils";
import { formatWeekday, toDateInputValue } from "@/lib/dates";
import { normalizeTripNoteContent } from "@/lib/tripNotes";
import { getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/prisma/db";
import { visiblePackingWhere, groupPackingItemsByEvent, type EventPackingItem } from "@/lib/packing";
import { isMultiNightLodging, lodgingPhaseForDay } from "@/lib/lodging";

interface Props {
  params: Promise<{ tripId: string }>;
}

/** Wrap the last word of a title in <em> for the editorial accent. */
function titleParts(title: string): { head: string; tail: string } {
  const m = title.match(/^(.*?)(\s+\S+)$/);
  if (!m) return { head: "", tail: title };
  return { head: m[1], tail: m[2] };
}

export default async function ItineraryPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  // ODY-067 Stage B: this viewer's own packing items scoped to an event
  // (always personal — see ChecklistItem's schema comment), grouped by
  // event so EventBlock can show a compact list without a per-event query.
  const [weather, dbUser] = await Promise.all([
    fetchWeather(trip.destination, trip.startDate, trip.endDate),
    getOrCreateDbUser(),
  ]);
  // Defensive: ChecklistItem.eventId only exists once `prisma db push` has
  // run against this database (see BACKLOG.md's required-deploy-step
  // warning). Degrade to "no per-event packing shown" instead of taking
  // down the whole itinerary page if that migration hasn't landed yet here.
  let packingByEvent = new Map<string, EventPackingItem[]>();
  try {
    const eventChecklistItems = await db.checklistItem.findMany({
      where: { ...visiblePackingWhere(tripId, dbUser.id), eventId: { not: null } },
      orderBy: { orderIndex: "asc" },
    });
    packingByEvent = groupPackingItemsByEvent(eventChecklistItems);
  } catch (err) {
    console.error("[itinerary] event-scoped packing items unavailable (has `prisma db push` run?):", err);
  }
  const enrichedDays = trip.days.map((d: (typeof trip.days)[number]) => ({
    ...d,
    events: d.events.map((e: (typeof d.events)[number]) => ({
      ...e,
      // Prisma types a Json column as unknown JSON; ODY-144's legs are only
      // ever written through the validated flight-leg schema, so this is a
      // safe reinterpret, not a real type hole.
      legs: e.legs as unknown as FlightLeg[] | null,
      packingItems: packingByEvent.get(e.id) ?? [],
      // Own check-in day's date — lets AddEventModal bound a lodging
      // checkout date picker regardless of which day's banner opened it.
      dayDate: d.date,
    })),
  }));

  // Multi-night lodging (hotel type, checkOutDate after its own day): pulled
  // out of the normal per-day list and shown as an all-day banner on every
  // day it spans instead — see lib/lodging.ts.
  const multiNightLodging = enrichedDays.flatMap((d) =>
    d.events.filter((e) => isMultiNightLodging(e.type, d.date, e.checkOutDate))
  );
  const allDayByDay = new Map<string, (typeof multiNightLodging[number] & { lodgingPhase: NonNullable<ReturnType<typeof lodgingPhaseForDay>> })[]>();
  for (const day of enrichedDays) {
    const spanning = multiNightLodging
      .map((e) => ({ event: e, phase: lodgingPhaseForDay(e.dayDate, e.checkOutDate!, day.date) }))
      .filter((x): x is { event: (typeof multiNightLodging)[number]; phase: NonNullable<ReturnType<typeof lodgingPhaseForDay>> } => x.phase !== null)
      .map(({ event, phase }) => ({ ...event, lodgingPhase: phase }));
    if (spanning.length > 0) allDayByDay.set(day.id, spanning);
  }

  const daysWithPacking = enrichedDays.map((d) => ({
    ...d,
    // Multi-night lodging lives in the all-day banner now, not the timed list.
    events: d.events.filter((e) => !isMultiNightLodging(e.type, d.date, e.checkOutDate)),
  }));

  const totalEvents = trip.days.reduce((n: number, d: (typeof trip.days)[number]) => n + d.events.length, 0);
  const dateRange = `${formatShortDate(trip.startDate)} – ${formatShortDate(trip.endDate)}`;
  const members = trip.members.map((m: (typeof trip.members)[number]) => ({ id: m.id, name: m.user?.name ?? "Traveler" }));
  const { head, tail } = titleParts(trip.title);
  const note = normalizeTripNoteContent(trip.note?.content);
  const readOnly = trip.myRole === "viewer"; // ODY-001

  // ODY-126: nudge a first-time visitor toward "Add section" once, before
  // this trip has ever had a custom section saved (sections stay [] server-
  // side until the first section write — the 3 starter sections are only a
  // client-render fallback). Viewers can't add sections, so skip for them.
  const notesHintDismissed = await getNotesHintDismissed(tripId);
  const showSectionsHint = !readOnly && !notesHintDismissed && note.sections.length === 0;

  // First-visit welcome for a freshly-joined member (ODY-085); eligibility
  // (non-owner, joined within a week) is computed in getTripById.
  const ownerName =
    trip.members.find((m: (typeof trip.members)[number]) => m.userId === trip.ownerId)?.user?.name ?? null;

  return (
    <div className="canvas">
      {trip.joinWelcome && (
        <JoinWelcome
          tripId={tripId}
          tripTitle={trip.title}
          role={trip.myRole as "editor" | "viewer"}
          memberName={trip.myName}
          ownerName={ownerName}
        />
      )}
      <ItineraryHero
        tripId={tripId}
        destination={trip.destination}
        dateRange={dateRange}
        title={trip.title}
        titleParts={{ head, tail }}
        members={members}
        weather={weather}
        totalDays={trip.days.length}
        totalEvents={totalEvents}
        trip={{
          startDate: trip.startDate,
          endDate: trip.endDate,
          timeFormat: trip.timeFormat,
          coverImageUrl: trip.coverImageUrl,
        }}
        canEdit={!readOnly}
      />

      <TripNotes
        tripId={tripId}
        initialText={note.text}
        initialSections={note.sections}
        readOnly={readOnly}
        showSectionsHint={showSectionsHint}
      />

      {totalEvents === 0 && trip.days.length > 0 && (
        <FirstSteps
          tripId={tripId}
          memberCount={trip.members.length}
          readOnly={readOnly}
        />
      )}

      {trip.days.length === 0 ? (
        <div className="empty-card tall">
          <p className="glyph sm" aria-hidden="true">🗓</p>
          <p className="headline soft">No days found for this trip.</p>
          <p className="sub mt">Check your trip dates in settings.</p>
        </div>
      ) : (
        (() => {
          // Day roster for the copy-events picker (ODY-033) and the edit
          // form's move-to-day picker (ODY-147), built once and shared by
          // every DayBlock.
          const dayRoster: DayOption[] = trip.days.map((d: (typeof trip.days)[number], i: number) => ({
            id: d.id,
            dayNumber: i + 1,
            label: `${formatWeekday(d.date)} · ${formatShortDate(d.date)}`,
            date: toDateInputValue(d.date),
          }));
          // One drag-and-drop surface across every day, so an event can be
          // dragged onto a different day (ODY-147).
          return (
            <ItineraryBoard timeFormat={trip.timeFormat as "12h" | "24h"}>
              {daysWithPacking.map((day, index: number) => (
                <DayBlock
                  key={day.id}
                  day={day as TripDay}
                  tripId={tripId}
                  dayNumber={index + 1}
                  readOnly={readOnly}
                  timeFormat={trip.timeFormat as "12h" | "24h"}
                  currency={trip.currency ?? "USD"}
                  destination={trip.destination}
                  days={dayRoster}
                  allDayEvents={(allDayByDay.get(day.id) ?? []) as TripEvent[]}
                />
              ))}
            </ItineraryBoard>
          );
        })()
      )}
    </div>
  );
}
