"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { createEventSchema, updateEventSchema } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
// Shared cached Nominatim client (ODY-010). Server-side geocoding stays the
// authoritative source of truth for pin coordinates so a map pin always
// matches the written address.
import { geocode } from "@/lib/geocode";
// Event↔expense linkage lives in lib so it's unit-testable (ODY-016).
import { syncLinkedExpense } from "@/lib/expenses";

const getDbUser = getOrCreateDbUser;

// All itinerary mutations require editor+ — viewers are read-only (ODY-001).
async function assertTripAccess(tripId: string, userId: string) {
  await assertTripRole(tripId, userId, "editor");
}

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}/itinerary`);
  revalidatePath(`/trips/${tripId}/map`);
  revalidatePath(`/trips/${tripId}/budget`);
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
}) {
  const dbUser = await getDbUser();
  await assertTripAccess(data.tripId, dbUser.id);

  const validated = createEventSchema.parse(data);

  // ODY-052: day must belong to the asserted trip (blocks cross-trip dayId IDOR).
  // Explore → itinerary save goes through this same path.
  const day = await db.day.findFirst({
    where: { id: validated.dayId, tripId: validated.tripId },
    select: { id: true },
  });
  if (!day) throw new Error("Not found");

  const lastEvent = await db.event.findFirst({
    where: { dayId: validated.dayId },
    orderBy: { orderIndex: "desc" },
  });

  // Server-side geocoding is authoritative: if there's an address but no
  // coordinates (e.g. the user never clicked "📍 Pin"), resolve it here so the
  // map pin always matches the written location.
  let lat = validated.lat ?? null;
  let lng = validated.lng ?? null;
  if (validated.location && (lat == null || lng == null)) {
    const coords = await geocode(validated.location, { userKey: dbUser.clerkId });
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  // Flights carry a second endpoint (arrival). Geocode it the same way.
  let destLat = validated.destLat ?? null;
  let destLng = validated.destLng ?? null;
  if (validated.destLocation && (destLat == null || destLng == null)) {
    const coords = await geocode(validated.destLocation, { userKey: dbUser.clerkId });
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
        location: validated.location || null,
        startTime: validated.startTime || null,
        endTime: validated.endTime || null,
        notes: validated.notes || null,
        cost: validated.cost ?? null,
        lat,
        lng,
        destLocation: validated.destLocation || null,
        destLat,
        destLng,
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
}>) {
  const dbUser = await getDbUser();

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  await assertTripAccess(event.tripId, dbUser.id);

  const validated = updateEventSchema.parse(data);

  const newLocation = validated.location || null;
  const locationChanged = "location" in validated && newLocation !== event.location;

  // Keep coordinates in sync with the address (authoritative, server-side):
  //  - address removed  -> clear coordinates
  //  - address changed  -> re-geocode (ignore any stale client coords)
  //  - address unchanged -> leave existing coordinates as-is
  let lat = validated.lat ?? event.lat;
  let lng = validated.lng ?? event.lng;
  if (locationChanged) {
    if (!newLocation) {
      lat = null;
      lng = null;
    } else {
      const coords = await geocode(newLocation, { userKey: dbUser.clerkId });
      lat = coords ? coords.lat : null;
      lng = coords ? coords.lng : null;
    }
  }

  // Mirror the same sync logic for a flight's arrival endpoint.
  const newDestLocation = validated.destLocation || null;
  const destChanged = "destLocation" in validated && newDestLocation !== event.destLocation;
  let destLat = validated.destLat ?? event.destLat;
  let destLng = validated.destLng ?? event.destLng;
  if (destChanged) {
    if (!newDestLocation) {
      destLat = null;
      destLng = null;
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
        startTime: validated.startTime || null,
        endTime: validated.endTime || null,
        notes: validated.notes || null,
        lat,
        lng,
        destLocation: newDestLocation,
        destLat,
        destLng,
      },
    });
    await syncLinkedExpense(next, tx);
    return next;
  });

  revalidateTrip(event.tripId);
  return updated;
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
