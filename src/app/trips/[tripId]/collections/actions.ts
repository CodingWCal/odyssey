"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { createPlaceSchema, updatePlaceSchema } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
import { geocode } from "@/lib/geocode";

/**
 * List places saved to a trip's collection (ODY-045). Any member can read.
 */
export async function listPlaces(tripId: string) {
  const dbUser = await getOrCreateDbUser();
  await assertTripRole(tripId, dbUser.id, "viewer");

  return db.place.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPlace(input: unknown) {
  const dbUser = await getOrCreateDbUser();
  const validated = createPlaceSchema.parse(input);
  await assertTripRole(validated.tripId, dbUser.id, "editor");

  let lat = validated.lat ?? null;
  let lng = validated.lng ?? null;
  if ((lat == null || lng == null) && validated.location?.trim()) {
    const coords = await geocode(validated.location);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  const place = await db.place.create({
    data: {
      tripId: validated.tripId,
      category: validated.category,
      title: validated.title.trim(),
      location: validated.location?.trim() || null,
      notes: validated.notes?.trim() || null,
      lat,
      lng,
      createdBy: dbUser.id,
    },
  });

  revalidatePath(`/trips/${validated.tripId}/collections`);
  revalidatePath(`/trips/${validated.tripId}/map`);
  return place;
}

export async function updatePlace(input: unknown) {
  const dbUser = await getOrCreateDbUser();
  const validated = updatePlaceSchema.parse(input);

  const existing = await db.place.findUnique({ where: { id: validated.id } });
  if (!existing) throw new Error("Not found");
  await assertTripRole(existing.tripId, dbUser.id, "editor");

  const nextLocation =
    validated.location !== undefined ? validated.location.trim() || null : existing.location;

  let lat = validated.lat !== undefined ? validated.lat : existing.lat;
  let lng = validated.lng !== undefined ? validated.lng : existing.lng;

  if (validated.location !== undefined && validated.lat === undefined && validated.lng === undefined) {
    if (nextLocation) {
      const coords = await geocode(nextLocation);
      lat = coords?.lat ?? null;
      lng = coords?.lng ?? null;
    } else {
      lat = null;
      lng = null;
    }
  }

  const place = await db.place.update({
    where: { id: validated.id },
    data: {
      ...(validated.category != null ? { category: validated.category } : {}),
      ...(validated.title != null ? { title: validated.title.trim() } : {}),
      ...(validated.location !== undefined ? { location: nextLocation } : {}),
      ...(validated.notes !== undefined ? { notes: validated.notes.trim() || null } : {}),
      lat,
      lng,
    },
  });

  revalidatePath(`/trips/${existing.tripId}/collections`);
  revalidatePath(`/trips/${existing.tripId}/map`);
  return place;
}

export async function deletePlace(placeId: string) {
  const dbUser = await getOrCreateDbUser();
  const existing = await db.place.findUnique({ where: { id: placeId } });
  if (!existing) throw new Error("Not found");
  await assertTripRole(existing.tripId, dbUser.id, "editor");

  await db.place.delete({ where: { id: placeId } });
  revalidatePath(`/trips/${existing.tripId}/collections`);
  revalidatePath(`/trips/${existing.tripId}/map`);
}
