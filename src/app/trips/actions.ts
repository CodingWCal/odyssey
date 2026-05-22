"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma/db";
import { createTripSchema, updateTripSchema } from "@/lib/validations";

async function getOrCreateUser() {
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

export async function getTripsByUser() {
  const { userId } = await auth();
  if (!userId) return [];

  const dbUser = await db.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return [];

  return db.trip.findMany({
    where: { members: { some: { userId: dbUser.id } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function getTripById(tripId: string) {
  const { userId } = await auth();
  if (!userId) return null;

  const dbUser = await db.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return null;

  const trip = await db.trip.findFirst({
    where: { id: tripId, members: { some: { userId: dbUser.id } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      },
      days: {
        include: { events: { orderBy: { orderIndex: "asc" } } },
        orderBy: { date: "asc" },
      },
    },
  });

  return trip;
}

export async function createTrip(formData: FormData) {
  const dbUser = await getOrCreateUser();

  const raw = {
    title: formData.get("title"),
    destination: formData.get("destination"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    totalBudget: formData.get("totalBudget") || undefined,
  };

  const validated = createTripSchema.parse(raw);

  const start = new Date(validated.startDate);
  const end = new Date(validated.endDate);

  const trip = await db.trip.create({
    data: {
      ownerId: dbUser.id,
      title: validated.title,
      destination: validated.destination,
      startDate: start,
      endDate: end,
      totalBudget: validated.totalBudget ?? null,
      members: { create: { userId: dbUser.id, role: "owner" } },
    },
  });

  // Auto-create Day records for each day of the trip
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (current <= endDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  await db.day.createMany({
    data: days.map((d) => ({ tripId: trip.id, date: d })),
  });

  revalidatePath("/dashboard");
  redirect(`/trips/${trip.id}/itinerary`);
}

export async function updateTrip(tripId: string, formData: FormData) {
  const dbUser = await getOrCreateUser();

  const member = await db.tripMember.findFirst({
    where: { tripId, userId: dbUser.id, role: "owner" },
  });
  if (!member) throw new Error("Unauthorized");

  const raw = {
    title: formData.get("title") || undefined,
    destination: formData.get("destination") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    totalBudget: formData.get("totalBudget") || undefined,
  };

  const validated = updateTripSchema.parse(raw);

  await db.trip.update({
    where: { id: tripId },
    data: {
      ...validated,
      startDate: validated.startDate ? new Date(validated.startDate) : undefined,
      endDate: validated.endDate ? new Date(validated.endDate) : undefined,
    },
  });

  revalidatePath(`/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  const dbUser = await getOrCreateUser();

  const member = await db.tripMember.findFirst({
    where: { tripId, userId: dbUser.id, role: "owner" },
  });
  if (!member) throw new Error("Unauthorized");

  await db.trip.delete({ where: { id: tripId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
