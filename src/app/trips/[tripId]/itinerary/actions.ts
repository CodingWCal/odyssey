"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import type { Prisma } from "@/generated/prisma/client";
import { createEventSchema, updateEventSchema } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

// All itinerary mutations require editor+ — viewers are read-only (ODY-001).
async function assertTripAccess(tripId: string, userId: string) {
  await assertTripRole(tripId, userId, "editor");
}

/**
 * Server-side geocoding via Nominatim. Authoritative source of truth for pin
 * coordinates so a map pin always matches the written address — independent of
 * whether the user clicked the client-side "📍 Pin" button.
 */
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      {
        headers: {
          "Accept-Language": "en",
          // Nominatim usage policy requires a descriptive User-Agent.
          "User-Agent": "Odyssey-TripPlanner/1.0 (collaborative itinerary app)",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}/itinerary`);
  revalidatePath(`/trips/${tripId}/map`);
  revalidatePath(`/trips/${tripId}/budget`);
  revalidatePath(`/trips/${tripId}`);
}

// Event type → budget expense category.
const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  flight: "flights",
  hotel: "lodging",
  restaurant: "food",
  activity: "activities",
  transport: "transport",
  misc: "misc",
};

/**
 * Keep a budget expense in sync with an event's cost (#5). Itinerary owns the
 * price: a positive cost creates/updates a linked expense; clearing it removes
 * the link. The expense stays editable on the Budget page.
 */
async function syncLinkedExpense(
  event: {
    id: string;
    tripId: string;
    type: string;
    title: string;
    cost: number | null;
    createdBy: string;
  },
  tx: Prisma.TransactionClient = db
) {
  const existing = await tx.expense.findFirst({ where: { eventId: event.id } });
  if (event.cost != null && event.cost > 0) {
    if (existing) {
      await tx.expense.update({ where: { id: existing.id }, data: { amount: event.cost } });
    } else {
      await tx.expense.create({
        data: {
          tripId: event.tripId,
          eventId: event.id,
          label: event.title,
          amount: event.cost,
          category: EVENT_TYPE_TO_CATEGORY[event.type] ?? "misc",
          addedBy: event.createdBy,
        },
      });
    }
  } else if (existing) {
    await tx.expense.delete({ where: { id: existing.id } });
  }
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
    const coords = await geocode(validated.location);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  // Flights carry a second endpoint (arrival). Geocode it the same way.
  let destLat = validated.destLat ?? null;
  let destLng = validated.destLng ?? null;
  if (validated.destLocation && (destLat == null || destLng == null)) {
    const coords = await geocode(validated.destLocation);
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
      const coords = await geocode(newLocation);
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
      const coords = await geocode(newDestLocation);
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
