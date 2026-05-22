"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { createEventSchema, updateEventSchema } from "@/lib/validations";

async function getDbUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  let dbUser = await db.user.findUnique({ where: { clerkId: user.id } });
  if (!dbUser) {
    dbUser = await db.user.create({
      data: {
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Traveler",
        avatarUrl: user.imageUrl ?? null,
      },
    });
  }
  return dbUser;
}

async function assertTripAccess(tripId: string, userId: string) {
  const member = await db.tripMember.findFirst({ where: { tripId, userId } });
  if (!member) throw new Error("Unauthorized");
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
}) {
  const dbUser = await getDbUser();
  await assertTripAccess(data.tripId, dbUser.id);

  const validated = createEventSchema.parse(data);

  const lastEvent = await db.event.findFirst({
    where: { dayId: validated.dayId },
    orderBy: { orderIndex: "desc" },
  });

  const event = await db.event.create({
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
      lat: validated.lat ?? null,
      lng: validated.lng ?? null,
      orderIndex: (lastEvent?.orderIndex ?? -1) + 1,
      createdBy: dbUser.id,
    },
  });

  revalidatePath(`/trips/${validated.tripId}/itinerary`);
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
}>) {
  const dbUser = await getDbUser();

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  await assertTripAccess(event.tripId, dbUser.id);

  const validated = updateEventSchema.parse(data);

  const updated = await db.event.update({
    where: { id: eventId },
    data: {
      ...validated,
      location: validated.location || null,
      startTime: validated.startTime || null,
      endTime: validated.endTime || null,
      notes: validated.notes || null,
    },
  });

  revalidatePath(`/trips/${event.tripId}/itinerary`);
  return updated;
}

export async function deleteEvent(eventId: string) {
  const dbUser = await getDbUser();

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  await assertTripAccess(event.tripId, dbUser.id);

  await db.event.delete({ where: { id: eventId } });
  revalidatePath(`/trips/${event.tripId}/itinerary`);
}

export async function reorderEvents(updates: { id: string; orderIndex: number }[], tripId: string) {
  const dbUser = await getDbUser();
  await assertTripAccess(tripId, dbUser.id);

  await Promise.all(
    updates.map((u) => db.event.update({ where: { id: u.id }, data: { orderIndex: u.orderIndex } }))
  );

  revalidatePath(`/trips/${tripId}/itinerary`);
}
