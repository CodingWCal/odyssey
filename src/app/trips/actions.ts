"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma/db";
import { createTripSchema, updateTripSchema, createTripWizardSchema, type CreateTripWizardInput } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
// Local-calendar helpers live in lib so they're unit-testable (ODY-016).
import { parseDateString, enumerateDays, dayKey, shiftDateUTC, daysBetweenUTC } from "@/lib/dates";
// Event↔expense linkage (shared with the itinerary actions), so a duplicated
// trip's event costs land on its budget the same way the original's did.
import { syncLinkedExpense } from "@/lib/expenses";

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
      // Lightweight signals for progressive nav reveal (ODY-075) — just
      // existence, not the rows themselves.
      availabilityPoll: { select: { id: true } },
      _count: { select: { places: true, checklistItems: true } },
    },
  });

  if (!trip) return null;

  // Surface the caller's own role so pages can hide edit affordances for
  // viewers (ODY-001). Server actions enforce this regardless.
  const myRole = (trip.members.find((m) => m.userId === dbUser.id)?.role ??
    "viewer") as "owner" | "editor" | "viewer";

  return { ...trip, myRole };
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

  // Local-midnight parsing keeps "2026-07-10" on July 10 regardless of TZ
  // (matches updateTrip; ODY-003).
  const start = parseDateString(validated.startDate);
  const end = parseDateString(validated.endDate);

  // Trip + its Day rows commit together (ODY-005).
  const trip = await db.$transaction(async (tx) => {
    const created = await tx.trip.create({
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
    await tx.day.createMany({
      data: enumerateDays(start, end).map((d) => ({ tripId: created.id, date: d })),
    });
    return created;
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

  // Local-midnight parsing keeps dates on the intended calendar day (ODY-003).
  const start = parseDateString(v.startDate);
  const end = parseDateString(v.endDate);

  // Trip + its Day rows commit together (ODY-005). Mirrors createTrip.
  const trip = await db.$transaction(async (tx) => {
    const created = await tx.trip.create({
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
    await tx.day.createMany({
      data: enumerateDays(start, end).map((d) => ({ tripId: created.id, date: d })),
    });
    return created;
  });

  revalidatePath("/dashboard");
  return { tripId: trip.id };
}

/**
 * Duplicate a whole trip the caller belongs to (ODY-033) — a fresh trip they
 * own, titled "… (copy)", with every day and event cloned. An optional
 * `newStartDate` ("YYYY-MM-DD") shifts the entire trip by the whole-day delta
 * so a loved itinerary can be re-run on new dates; omitted, it's an exact-date
 * clone. The budget starts clean except for event-linked costs, which are
 * re-synced so the copy's planned spend matches the original. Returns the new
 * trip id so the client can navigate to it.
 */
export async function duplicateTrip(
  tripId: string,
  newStartDate?: string
): Promise<{ tripId: string }> {
  const dbUser = await getOrCreateUser();

  // Membership is the authorization boundary — any member can make their own
  // copy (they become its owner).
  const source = await db.trip.findFirst({
    where: { id: tripId, members: { some: { userId: dbUser.id } } },
    include: {
      days: { include: { events: { orderBy: { orderIndex: "asc" } } }, orderBy: { date: "asc" } },
    },
  });
  if (!source) throw new Error("Not found");

  const delta = newStartDate
    ? daysBetweenUTC(source.startDate, parseDateString(newStartDate))
    : 0;

  // Trip + its days + events (+ linked expenses) all commit together (ODY-005).
  const created = await db.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        ownerId: dbUser.id,
        title: `${source.title} (copy)`,
        destination: source.destination,
        startDate: shiftDateUTC(source.startDate, delta),
        endDate: shiftDateUTC(source.endDate, delta),
        coverImageUrl: source.coverImageUrl,
        totalBudget: source.totalBudget,
        currency: source.currency,
        timeFormat: source.timeFormat,
        members: { create: { userId: dbUser.id, role: "owner" } },
      },
    });

    for (const day of source.days) {
      const newDay = await tx.day.create({
        data: {
          tripId: trip.id,
          date: shiftDateUTC(day.date, delta),
          label: day.label,
          notes: day.notes,
        },
      });
      for (const ev of day.events) {
        const clone = await tx.event.create({
          data: {
            dayId: newDay.id,
            tripId: trip.id,
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
            orderIndex: ev.orderIndex,
            createdBy: dbUser.id,
          },
        });
        await syncLinkedExpense(clone, tx);
      }
    }
    return trip;
  });

  revalidatePath("/dashboard");
  return { tripId: created.id };
}

export async function updateTrip(tripId: string, formData: FormData) {
  const dbUser = await getOrCreateUser();

  // Any editor+ can edit shared trip details; viewers are read-only (ODY-001).
  await assertTripRole(tripId, dbUser.id, "editor");

  const raw = {
    title: formData.get("title") || undefined,
    destination: formData.get("destination") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    totalBudget: formData.get("totalBudget") || undefined,
    timeFormat: formData.get("timeFormat") || undefined,
    coverIndex: formData.get("coverIndex") || undefined,
    currency: formData.get("currency") || undefined,
  };

  const validated = updateTripSchema.parse(raw);
  // Omit date strings so they can't overwrite the Date fields below.
  const { coverIndex, startDate: startStr, endDate: endStr, ...tripFields } = validated;

  // Parse dates in local timezone (date string like "2026-07-17" should be July 17 local)
  const startDate = startStr ? parseDateString(startStr) : undefined;
  const endDate = endStr ? parseDateString(endStr) : undefined;

  await db.trip.update({
    where: { id: tripId },
    data: {
      ...tripFields,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(coverIndex != null ? { coverImageUrl: `grad:${coverIndex}` } : {}),
    },
  });

  // If dates changed, reconcile Day records to the new range WITHOUT destroying
  // days that hold events. Create missing days; delete out-of-range days only
  // when they are empty (preserve out-of-range days that still contain events).
  if (startDate && endDate) {
    const existing = await db.day.findMany({
      where: { tripId },
      select: { id: true, date: true, _count: { select: { events: true } } },
    });

    // Target dates in the new range (local midnight), deduped by calendar day.
    const target = new Map<string, Date>();
    for (const d of enumerateDays(startDate, endDate)) target.set(dayKey(d), d);

    const existingKeys = new Set(existing.map((d) => dayKey(d.date)));

    const toCreate = [...target.entries()]
      .filter(([k]) => !existingKeys.has(k))
      .map(([, d]) => ({ tripId, date: d }));

    const toDelete = existing
      .filter((d) => !target.has(dayKey(d.date)) && d._count.events === 0)
      .map((d) => d.id);

    const ops = [];
    if (toDelete.length) ops.push(db.day.deleteMany({ where: { id: { in: toDelete } } }));
    if (toCreate.length) ops.push(db.day.createMany({ data: toCreate }));
    if (ops.length) await db.$transaction(ops);
  }

  // Revalidate the whole trip layout so the sidebar/hero pick up the new name.
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath("/dashboard");
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

/** Per-member soft-hide of a trip from *this member's own* dashboard (ODY-082).
 * Any member can archive/restore their own view — it sets `archivedAt` on their
 * TripMember row only, so it never deletes data or changes what anyone else
 * sees. Fully restorable. */
async function setMyArchived(tripId: string, archivedAt: Date | null) {
  const dbUser = await getOrCreateUser();
  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");
  await db.tripMember.update({ where: { id: member.id }, data: { archivedAt } });
  revalidatePath("/dashboard");
}

export async function archiveTrip(tripId: string) {
  await setMyArchived(tripId, new Date());
}

export async function unarchiveTrip(tripId: string) {
  await setMyArchived(tripId, null);
}
