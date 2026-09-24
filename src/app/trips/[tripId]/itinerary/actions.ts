"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { Prisma } from "@/generated/prisma/client";
import { createEventSchema, updateEventSchema, moveEventSchema, type CreateEventInput } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
// Shared cached Nominatim client (ODY-010). Server-side geocoding stays the
// authoritative source of truth for pin coordinates so a map pin always
// matches the written address.
import { geocode } from "@/lib/geocode";
// Event↔expense linkage lives in lib so it's unit-testable (ODY-016).
import { syncLinkedExpense } from "@/lib/expenses";
import { parseDateString, daysBetweenUTC, shiftDateUTC } from "@/lib/dates";
import type { FlightLeg } from "@/types";

/**
 * Multi-leg flights (ODY-144): the raw Zod-validated legs use `string |
 * undefined` for optional fields (Zod's `.optional().or(literal(""))`
 * idiom); the stored/read shape (`FlightLeg`) uses `string | null`
 * everywhere, matching every other nullable field in this schema. Normalize
 * once here rather than let two shapes drift.
 */
function normalizeLegs(legs: CreateEventInput["legs"]): FlightLeg[] | null {
  if (!legs || legs.length === 0) return null;
  return legs.map((l) => ({
    flightNumber: l.flightNumber || null,
    from: l.from,
    fromLat: l.fromLat ?? null,
    fromLng: l.fromLng ?? null,
    to: l.to,
    toLat: l.toLat ?? null,
    toLng: l.toLng ?? null,
    departTime: l.departTime,
    arriveTime: l.arriveTime,
    operatedBy: l.operatedBy || null,
  }));
}

/** Prisma's Json input type wants an index signature FlightLeg[] doesn't
 * have (and a separate sentinel for "set the column to NULL") — this is a
 * safe reinterpret, not a real type hole, since these are always our own
 * validated/normalized objects. */
function legsJson(legs: FlightLeg[] | null): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return legs ? (legs as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}

/**
 * When `legs` is present (flight type, any length including 1), it
 * supersedes the client-sent location/destLocation/startTime/endTime —
 * derived from the first/last leg so the rest of the app (map pins, day
 * sort, budget) keeps reading the same top-level fields unchanged, with one
 * source of truth (the legs array) rather than the client independently
 * computing the same thing.
 */
function deriveFromLegs(legs: FlightLeg[]) {
  const first = legs[0];
  const last = legs[legs.length - 1];
  return {
    location: first.from,
    lat: first.fromLat,
    lng: first.fromLng,
    destLocation: last.to,
    destLat: last.toLat,
    destLng: last.toLng,
    startTime: first.departTime,
    endTime: last.arriveTime,
  };
}

/** Multi-night lodging: checkout can't be before check-in (the event's own day). */
function assertCheckOutNotBeforeCheckIn(checkInDate: Date, checkOutDate: Date | null) {
  if (checkOutDate && daysBetweenUTC(checkInDate, checkOutDate) < 0) {
    throw new Error("Check-out date can't be before check-in");
  }
}

/**
 * Resolve moving an event to another day of the same trip (ODY-147) — null
 * when the target is its current day. The target must belong to the event's
 * own trip (the same IDOR guard as createEvent's ODY-052 day check). The
 * event lands after the target day's last orderIndex, like a new event.
 */
async function resolveDayMove(tripId: string, fromDayId: string, targetDayId: string) {
  if (targetDayId === fromDayId) return null;
  const target = await db.day.findFirst({ where: { id: targetDayId, tripId }, select: { id: true, date: true } });
  if (!target) throw new Error("Not found");
  const last = await db.event.findFirst({
    where: { dayId: target.id },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  return { dayId: target.id, date: target.date, orderIndex: (last?.orderIndex ?? -1) + 1 };
}

const getDbUser = getOrCreateDbUser;

// All itinerary mutations require editor+ — viewers are read-only (ODY-001).
async function assertTripAccess(tripId: string, userId: string) {
  await assertTripRole(tripId, userId, "editor");
}

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}/itinerary`);
  revalidatePath(`/trips/${tripId}/map`);
  revalidatePath(`/trips/${tripId}/budget`);
  // Deleting an event cascades to its packing items (ODY-067 Stage B).
  revalidatePath(`/trips/${tripId}/packing`);
  revalidatePath(`/trips/${tripId}`);
}

export async function createEvent(data: {
  dayId: string;
  tripId: string;
  type: string;
  title: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  cost?: number;
  lat?: number;
  lng?: number;
  destLocation?: string;
  destLat?: number;
  destLng?: number;
  confirmationCode?: string;
  bookingUrl?: string;
  checkIn?: string;
  layover?: string;
  legs?: FlightLeg[];
  checkOutDate?: string;
}) {
  const dbUser = await getDbUser();
  await assertTripAccess(data.tripId, dbUser.id);

  const validated = createEventSchema.parse(data);
  const legs = normalizeLegs(validated.legs);
  const derived = legs ? deriveFromLegs(legs) : null;

  // ODY-052: day must belong to the asserted trip (blocks cross-trip dayId IDOR).
  // Explore → itinerary save goes through this same path.
  const day = await db.day.findFirst({
    where: { id: validated.dayId, tripId: validated.tripId },
    select: { id: true, date: true },
  });
  if (!day) throw new Error("Not found");

  // Multi-night lodging (ODY-lodging): checkout can't be before the event's
  // own (check-in) day. The client's date-input min= enforces this too;
  // this is the authoritative check.
  const checkOutDate = validated.checkOutDate ? parseDateString(validated.checkOutDate) : null;
  assertCheckOutNotBeforeCheckIn(day.date, checkOutDate);

  const lastEvent = await db.event.findFirst({
    where: { dayId: validated.dayId },
    orderBy: { orderIndex: "desc" },
  });

  // Multi-leg flights (ODY-144): the legs array is the source of truth for
  // these fields when present — the client-sent values are ignored.
  const location = derived?.location ?? (validated.location || null);
  const startTime = derived?.startTime ?? (validated.startTime || null);
  const endTime = derived?.endTime ?? (validated.endTime || null);
  const destLocation = derived?.destLocation ?? (validated.destLocation || null);

  // Server-side geocoding is authoritative: if there's an address but no
  // coordinates (e.g. the user never clicked "📍 Pin"), resolve it here so the
  // map pin always matches the written location.
  // A derived (legs) location uses only that leg's own coordinates — never
  // falls back to client/stale top-level coords, which belong to whatever
  // the location was before.
  let lat = derived ? derived.lat : (validated.lat ?? null);
  let lng = derived ? derived.lng : (validated.lng ?? null);
  if (location && (lat == null || lng == null)) {
    const coords = await geocode(location, { userKey: dbUser.clerkId });
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  // Flights carry a second endpoint (arrival). Geocode it the same way.
  let destLat = derived ? derived.destLat : (validated.destLat ?? null);
  let destLng = derived ? derived.destLng : (validated.destLng ?? null);
  if (destLocation && (destLat == null || destLng == null)) {
    const coords = await geocode(destLocation, { userKey: dbUser.clerkId });
    if (coords) {
      destLat = coords.lat;
      destLng = coords.lng;
    }
  }

  // Event + linked expense commit together (ODY-005): no orphaned half-state.
  const event = await db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        dayId: validated.dayId,
        tripId: validated.tripId,
        type: validated.type,
        title: validated.title,
        location,
        startTime,
        endTime,
        notes: validated.notes || null,
        cost: validated.cost ?? null,
        lat,
        lng,
        destLocation,
        destLat,
        destLng,
        confirmationCode: validated.confirmationCode || null,
        bookingUrl: validated.bookingUrl || null,
        checkIn: validated.checkIn || null,
        // legs (ODY-144) supersedes the free-text layover once present.
        layover: legs ? null : (validated.layover || null),
        legs: legsJson(legs),
        checkOutDate,
        orderIndex: (lastEvent?.orderIndex ?? -1) + 1,
        createdBy: dbUser.id,
      },
    });
    await syncLinkedExpense(created, tx);
    return created;
  });

  revalidateTrip(validated.tripId);
  return event;
}

export async function updateEvent(eventId: string, data: Partial<{
  type: string;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  notes: string;
  cost: number;
  lat: number;
  lng: number;
  destLocation: string;
  destLat: number;
  destLng: number;
  confirmationCode: string;
  bookingUrl: string;
  checkIn: string;
  layover: string;
  legs: FlightLeg[];
  checkOutDate: string;
  dayId: string;
}>) {
  const dbUser = await getDbUser();

  const event = await db.event.findUnique({ where: { id: eventId }, include: { day: { select: { date: true } } } });
  if (!event) throw new Error("Event not found");
  await assertTripAccess(event.tripId, dbUser.id);

  const validated = updateEventSchema.parse(data);

  // Multi-leg flights (ODY-144). legsProvided distinguishes "the caller
  // didn't touch legs" (undefined, leave the DB field alone) from "the
  // caller sent an empty array" (null, clear it — e.g. switching away from
  // flight). A non-empty legs array is the source of truth for
  // location/destLocation/startTime/endTime below, same as createEvent.
  const legsProvided = "legs" in validated;
  const legs = legsProvided ? normalizeLegs(validated.legs) : undefined;
  const derived = legs && legs.length > 0 ? deriveFromLegs(legs) : null;

  // Moving to another day from the edit form (ODY-147) — null when the day is
  // unchanged. The target day must belong to this event's trip.
  const move = validated.dayId ? await resolveDayMove(event.tripId, event.dayId, validated.dayId) : null;

  // Multi-night lodging: checkout can't be before the event's own (check-in)
  // day — the day it's moving to, if it's moving. Checked against the stored
  // checkout too, so moving a stay past its own checkout is rejected.
  const checkOutDate =
    "checkOutDate" in validated ? (validated.checkOutDate ? parseDateString(validated.checkOutDate) : null) : undefined;
  assertCheckOutNotBeforeCheckIn(move?.date ?? event.day.date, checkOutDate !== undefined ? checkOutDate : event.checkOutDate);

  const newLocation = derived ? derived.location : (validated.location || null);
  const locationChanged = derived != null || ("location" in validated && newLocation !== event.location);

  // Keep coordinates in sync with the address (authoritative, server-side):
  //  - address removed  -> clear coordinates
  //  - address changed  -> re-geocode (ignore any stale client coords)
  //  - address unchanged -> leave existing coordinates as-is
  // A derived (legs) location instead uses that leg's own picked
  // coordinates, only geocoding if the leg didn't have them.
  let lat = derived ? derived.lat : (validated.lat ?? event.lat);
  let lng = derived ? derived.lng : (validated.lng ?? event.lng);
  if (locationChanged) {
    if (!newLocation) {
      lat = null;
      lng = null;
    } else if (derived) {
      if (lat == null || lng == null) {
        const coords = await geocode(newLocation, { userKey: dbUser.clerkId });
        lat = coords ? coords.lat : null;
        lng = coords ? coords.lng : null;
      }
    } else {
      const coords = await geocode(newLocation, { userKey: dbUser.clerkId });
      lat = coords ? coords.lat : null;
      lng = coords ? coords.lng : null;
    }
  }

  // Mirror the same sync logic for a flight's arrival endpoint.
  const newDestLocation = derived ? derived.destLocation : (validated.destLocation || null);
  const destChanged = derived != null || ("destLocation" in validated && newDestLocation !== event.destLocation);
  let destLat = derived ? derived.destLat : (validated.destLat ?? event.destLat);
  let destLng = derived ? derived.destLng : (validated.destLng ?? event.destLng);
  if (destChanged) {
    if (!newDestLocation) {
      destLat = null;
      destLng = null;
    } else if (derived) {
      if (destLat == null || destLng == null) {
        const coords = await geocode(newDestLocation, { userKey: dbUser.clerkId });
        destLat = coords ? coords.lat : null;
        destLng = coords ? coords.lng : null;
      }
    } else {
      const coords = await geocode(newDestLocation, { userKey: dbUser.clerkId });
      destLat = coords ? coords.lat : null;
      destLng = coords ? coords.lng : null;
    }
  }

  // Event + linked expense commit together (ODY-005).
  const updated = await db.$transaction(async (tx) => {
    const next = await tx.event.update({
      where: { id: eventId },
      data: {
        ...validated,
        location: newLocation,
        startTime: derived ? derived.startTime : (validated.startTime || null),
        endTime: derived ? derived.endTime : (validated.endTime || null),
        notes: validated.notes || null,
        lat,
        lng,
        destLocation: newDestLocation,
        destLat,
        destLng,
        // Booking details (ODY-086): only touch a field the caller sent;
        // empty string clears it.
        ...("confirmationCode" in validated ? { confirmationCode: validated.confirmationCode || null } : {}),
        ...("bookingUrl" in validated ? { bookingUrl: validated.bookingUrl || null } : {}),
        ...("checkIn" in validated ? { checkIn: validated.checkIn || null } : {}),
        // legs (ODY-144) supersedes layover once there's more than one leg —
        // force-clear it even if the caller didn't separately touch layover,
        // so an upgraded flight doesn't keep showing stale free-text
        // alongside the new structured legs.
        ...(legs && legs.length > 1
          ? { layover: null }
          : "layover" in validated
            ? { layover: validated.layover || null }
            : {}),
        ...(legsProvided ? { legs: legsJson(legs ?? null) } : {}),
        ...(checkOutDate !== undefined ? { checkOutDate } : {}),
        // Always the verified day — never the raw client dayId `...validated`
        // spread in above (ODY-147).
        ...(move ? { dayId: move.dayId, orderIndex: move.orderIndex } : { dayId: event.dayId }),
      },
    });
    await syncLinkedExpense(next, tx);
    return next;
  });

  revalidateTrip(event.tripId);
  return updated;
}

/**
 * Drag-and-drop an event onto another day of the same trip (ODY-147).
 * Deliberately not updateEvent(id, { dayId }): updateEvent treats its payload
 * as the whole edit form, so a partial payload would clear the location,
 * times and notes it leaves out.
 */
export async function moveEventToDay(eventId: string, targetDayId: string) {
  const dbUser = await getDbUser();
  const input = moveEventSchema.parse({ eventId, targetDayId });

  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: { tripId: true, dayId: true, checkOutDate: true, day: { select: { date: true } } },
  });
  if (!event) throw new Error("Event not found");
  await assertTripAccess(event.tripId, dbUser.id);

  const move = await resolveDayMove(event.tripId, event.dayId, input.targetDayId);
  if (!move) return;

  // Moving lodging moves the whole stay: shift checkout by the same number of
  // days so a same-day hotel (the only kind in the draggable timed list) stays
  // valid instead of ending up checking out before it checks in.
  const checkOutDate = event.checkOutDate
    ? shiftDateUTC(event.checkOutDate, daysBetweenUTC(event.day.date, move.date))
    : null;
  assertCheckOutNotBeforeCheckIn(move.date, checkOutDate);

  await db.event.update({
    where: { id: input.eventId },
    data: { dayId: move.dayId, orderIndex: move.orderIndex, checkOutDate },
  });
  revalidateTrip(event.tripId);
}

export async function deleteEvent(eventId: string) {
  const dbUser = await getDbUser();

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  await assertTripAccess(event.tripId, dbUser.id);

  // Remove any budget expense linked to this event so the budget stays
  // consistent — atomically with the event itself (ODY-005).
  await db.$transaction([
    db.expense.deleteMany({ where: { eventId } }),
    db.event.delete({ where: { id: eventId } }),
  ]);
  revalidateTrip(event.tripId);
}

export async function reorderEvents(updates: { id: string; orderIndex: number }[], tripId: string) {
  const dbUser = await getDbUser();
  await assertTripAccess(tripId, dbUser.id);

  // Scope each update to this trip so foreign event ids are ignored.
  // Single transaction so a reorder never half-applies (ODY-005).
  await db.$transaction(
    updates.map((u) => db.event.updateMany({ where: { id: u.id, tripId }, data: { orderIndex: u.orderIndex } }))
  );

  revalidateTrip(tripId);
}

/**
 * Copy every event from one day onto another within the same trip (ODY-033).
 * Clones the events (new rows, same details/times) appended after the target's
 * existing events, and re-links any budget expense so the copy's costs land on
 * the budget too. Source day notes are left alone — this copies the plan, not
 * the scratchpad. Editor+ only; both days must belong to `tripId`.
 */
export async function copyDayEvents(sourceDayId: string, targetDayId: string, tripId: string) {
  const dbUser = await getDbUser();
  await assertTripAccess(tripId, dbUser.id);
  if (sourceDayId === targetDayId) return;

  // Both days scoped to this trip — blocks copying across trips via a foreign
  // day id (mirrors the ODY-052 dayId guard).
  const [source, target] = await Promise.all([
    db.day.findFirst({
      where: { id: sourceDayId, tripId },
      include: { events: { orderBy: { orderIndex: "asc" } } },
    }),
    db.day.findFirst({ where: { id: targetDayId, tripId }, select: { id: true } }),
  ]);
  if (!source || !target) throw new Error("Not found");
  if (source.events.length === 0) return;

  const last = await db.event.findFirst({
    where: { dayId: targetDayId },
    orderBy: { orderIndex: "desc" },
  });
  let nextIndex = (last?.orderIndex ?? -1) + 1;

  // All clones (and their linked expenses) commit together (ODY-005).
  await db.$transaction(async (tx) => {
    for (const ev of source.events) {
      const created = await tx.event.create({
        data: {
          dayId: targetDayId,
          tripId,
          type: ev.type,
          title: ev.title,
          location: ev.location,
          startTime: ev.startTime,
          endTime: ev.endTime,
          notes: ev.notes,
          cost: ev.cost,
          lat: ev.lat,
          lng: ev.lng,
          destLocation: ev.destLocation,
          destLat: ev.destLat,
          destLng: ev.destLng,
          // Multi-leg flight structure (ODY-144) is part of the plan, not a
          // booking detail — without it a copied BOS→LAX→HNL flight would
          // collapse to a single BOS→HNL route with no layover.
          legs: ev.legs == null ? Prisma.DbNull : (ev.legs as Prisma.InputJsonValue),
          orderIndex: nextIndex++,
          createdBy: dbUser.id,
        },
      });
      await syncLinkedExpense(created, tx);
    }
  });

  revalidateTrip(tripId);
}

export async function updateDayNotes(dayId: string, tripId: string, notes: string) {
  const dbUser = await getDbUser();
  await assertTripAccess(tripId, dbUser.id);

  // Scope to this trip so a day id from another trip can't be edited.
  await db.day.updateMany({
    where: { id: dayId, tripId },
    data: { notes: notes.trim() || null },
  });

  revalidatePath(`/trips/${tripId}/itinerary`);
}

/**
 * Manual override for a day's header location (ODY-141), e.g. "Oahu" vs
 * "Maui" on a multi-island Hawaii trip where events don't exist yet to
 * auto-derive it from. Reuses the existing (previously unused) Day.label
 * column — no schema change. Empty clears the override and falls back to
 * deriveDayLocation's automatic guess.
 */
export async function updateDayLabel(dayId: string, tripId: string, label: string) {
  const dbUser = await getDbUser();
  await assertTripAccess(tripId, dbUser.id);

  if (label.length > 80) throw new Error("Keep it under 80 characters");

  // Scope to this trip so a day id from another trip can't be edited.
  await db.day.updateMany({
    where: { id: dayId, tripId },
    data: { label: label.trim() || null },
  });

  revalidatePath(`/trips/${tripId}/itinerary`);
}
