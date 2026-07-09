"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma/db";
import { createTripSchema, updateTripSchema, createTripWizardSchema, type CreateTripWizardInput } from "@/lib/validations";
import { getOrCreateDbUser } from "@/lib/auth";

const getOrCreateUser = getOrCreateDbUser;

export async function getTripsByUser() {
  // Resolve via getOrCreateUser (not a raw clerkId lookup) so an invited user's
  // pending placeholder gets relinked to their real account on first visit —
  // otherwise their trip memberships would never connect to their account.
  let dbUser;
  try {
    dbUser = await getOrCreateUser();
  } catch {
    return [];
  }

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
  // Relink an invited user's pending placeholder on first visit (see note in
  // getTripsByUser) so trip access works without requiring a write action first.
  let dbUser;
  try {
    dbUser = await getOrCreateUser();
  } catch {
    return null;
  }

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
      note: true,
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

/**
 * Create a trip from the multi-step new-trip wizard. Unlike createTrip, this
 * returns the new trip id (no redirect) so the client can fire off invites and
 * then navigate. Cover mood is stored as "grad:<index>" in coverImageUrl.
 */
export async function createTripWizard(
  data: CreateTripWizardInput
): Promise<{ tripId: string }> {
  const dbUser = await getOrCreateUser();
  const v = createTripWizardSchema.parse(data);

  const start = new Date(v.startDate);
  const end = new Date(v.endDate);

  const trip = await db.trip.create({
    data: {
      ownerId: dbUser.id,
      title: v.title,
      destination: v.destination,
      startDate: start,
      endDate: end,
      totalBudget: v.totalBudget ?? null,
      coverImageUrl: v.coverIndex != null ? `grad:${v.coverIndex}` : null,
      members: { create: { userId: dbUser.id, role: "owner" } },
    },
  });

  // Auto-create a Day per calendar day of the trip (mirrors createTrip).
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (current <= endDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  await db.day.createMany({ data: days.map((d) => ({ tripId: trip.id, date: d })) });

  revalidatePath("/dashboard");
  return { tripId: trip.id };
}

export async function updateTrip(tripId: string, formData: FormData) {
  const dbUser = await getOrCreateUser();

  // Any trip member can edit shared trip details (e.g. the name).
  const member = await db.tripMember.findFirst({
    where: { tripId, userId: dbUser.id },
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

  // Parse dates in local timezone (date string like "2026-07-17" should be July 17 local)
  const startDate = validated.startDate ? parseDateString(validated.startDate) : undefined;
  const endDate = validated.endDate ? parseDateString(validated.endDate) : undefined;

  await db.trip.update({
    where: { id: tripId },
    data: {
      ...validated,
      startDate,
      endDate,
    },
  });

  // If dates changed, regenerate Day records to match the new date range
  if (startDate && endDate) {
    // Delete old days
    await db.day.deleteMany({ where: { tripId } });

    // Create new days for each day in the updated range
    const days: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);
    while (current <= endDay) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    await db.day.createMany({
      data: days.map((d) => ({ tripId, date: d })),
    });
  }

  // Revalidate the whole trip layout so the sidebar/hero pick up the new name.
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath("/dashboard");
}

function parseDateString(dateStr: string): Date {
  // Parse "YYYY-MM-DD" as local date (not UTC)
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return date;
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
