"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import {
  applyWindowSchema,
  createPollSchema,
  setSlotsSchema,
  type ApplyWindowInput,
  type CreatePollInput,
  type SetSlotsInput,
} from "@/lib/validations";
import { getOrCreateDbUser } from "@/lib/auth";
import type {
  AvailabilityBlock,
  AvailabilityStatus,
} from "@/types";

const getDbUser = getOrCreateDbUser;

type ScheduleMember = {
  id: string;
  tripId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

type ScheduleSlot = {
  id: string;
  tripId: string;
  userId: string;
  date: Date;
  block: AvailabilityBlock;
  status: AvailabilityStatus;
  source: string;
  updatedAt: Date;
};

type SchedulePoll = {
  id: string;
  tripId: string;
  rangeStart: Date;
  rangeEnd: Date;
  enabledBlocks: AvailabilityBlock[];
  desiredLengthDays: number | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type BestWindow = {
  startDate: string;
  endDate: string;
  score: number;
  availableCount: number;
};

export type GetScheduleResult = {
  poll: SchedulePoll | null;
  slots: ScheduleSlot[];
  members: ScheduleMember[];
  bestWindow: BestWindow | null;
};

function toDateKey(date: Date): string {
  // Normalize to a UTC calendar-day key (YYYY-MM-DD).
  return date.toISOString().slice(0, 10);
}

export async function getSchedule(tripId: string): Promise<GetScheduleResult> {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({
    where: { tripId, userId: dbUser.id },
  });
  if (!member) throw new Error("Unauthorized");

  const [pollRow, slotRows, memberRows] = await Promise.all([
    db.availabilityPoll.findUnique({ where: { tripId } }),
    db.availabilitySlot.findMany({ where: { tripId } }),
    db.tripMember.findMany({
      where: { tripId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
    }),
  ]);

  const poll: SchedulePoll | null = pollRow
    ? {
        id: pollRow.id,
        tripId: pollRow.tripId,
        rangeStart: pollRow.rangeStart,
        rangeEnd: pollRow.rangeEnd,
        enabledBlocks: pollRow.enabledBlocks as AvailabilityBlock[],
        desiredLengthDays: pollRow.desiredLengthDays,
        status: pollRow.status,
        createdBy: pollRow.createdBy,
        createdAt: pollRow.createdAt,
        updatedAt: pollRow.updatedAt,
      }
    : null;

  const slots: ScheduleSlot[] = slotRows.map((s) => ({
    id: s.id,
    tripId: s.tripId,
    userId: s.userId,
    date: s.date,
    block: s.block as AvailabilityBlock,
    status: s.status as AvailabilityStatus,
    source: s.source,
    updatedAt: s.updatedAt,
  }));

  const members: ScheduleMember[] = memberRows.map((m) => ({
    id: m.id,
    tripId: m.tripId,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt,
    user: m.user,
  }));

  // Dedupe by userId+date+block, preferring source="manual" over others
  // (e.g. a future "google" source). Manual always wins.
  const deduped = new Map<string, ScheduleSlot>();
  for (const slot of slots) {
    const key = `${slot.userId}|${toDateKey(slot.date)}|${slot.block}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, slot);
      continue;
    }
    if (existing.source !== "manual" && slot.source === "manual") {
      deduped.set(key, slot);
    }
  }

  const bestWindow = poll
    ? computeBestWindow(poll, Array.from(deduped.values()))
    : null;

  return { poll, slots, members, bestWindow };
}

function computeBestWindow(
  poll: SchedulePoll,
  slots: ScheduleSlot[]
): BestWindow | null {
  const enabledBlocks = poll.enabledBlocks;
  if (enabledBlocks.length === 0) return null;

  // Build the list of calendar dates in [rangeStart..rangeEnd].
  const dates: Date[] = [];
  const current = new Date(poll.rangeStart);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(poll.rangeEnd);
  end.setUTCHours(0, 0, 0, 0);
  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  if (dates.length === 0) return null;

  // Index slots by dateKey -> block -> { available:Set, maybe:Set } of userIds.
  type BlockTally = { available: Set<string>; maybe: Set<string> };
  const byDate = new Map<string, Map<string, BlockTally>>();
  for (const slot of slots) {
    const dateKey = toDateKey(slot.date);
    if (!enabledBlocks.includes(slot.block)) continue;
    let blockMap = byDate.get(dateKey);
    if (!blockMap) {
      blockMap = new Map();
      byDate.set(dateKey, blockMap);
    }
    let tally = blockMap.get(slot.block);
    if (!tally) {
      tally = { available: new Set(), maybe: new Set() };
      blockMap.set(slot.block, tally);
    }
    if (slot.status === "available") tally.available.add(slot.userId);
    else if (slot.status === "maybe") tally.maybe.add(slot.userId);
  }

  // Per-date score and distinct "available" headcount across enabled blocks.
  const perDate = dates.map((d) => {
    const dateKey = toDateKey(d);
    const blockMap = byDate.get(dateKey);
    let score = 0;
    const availableUsers = new Set<string>();
    if (blockMap) {
      for (const block of enabledBlocks) {
        const tally = blockMap.get(block);
        if (!tally) continue;
        score += tally.available.size + 0.5 * tally.maybe.size;
        for (const u of tally.available) availableUsers.add(u);
      }
    }
    return { date: d, score, availableCount: availableUsers.size };
  });

  const windowLen = Math.max(1, poll.desiredLengthDays ?? 1);
  if (windowLen > perDate.length) return null;

  let best: BestWindow | null = null;
  for (let i = 0; i + windowLen <= perDate.length; i++) {
    let score = 0;
    let availableCount = 0;
    for (let j = i; j < i + windowLen; j++) {
      score += perDate[j].score;
      availableCount += perDate[j].availableCount;
    }
    if (best === null || score > best.score) {
      best = {
        startDate: toDateKey(perDate[i].date),
        endDate: toDateKey(perDate[i + windowLen - 1].date),
        score,
        availableCount,
      };
    }
  }

  return best;
}

export async function upsertPoll(data: CreatePollInput) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({
    where: { tripId: data.tripId, userId: dbUser.id, role: "owner" },
  });
  if (!member) throw new Error("Unauthorized");

  const validated = createPollSchema.parse(data);

  const rangeStart = new Date(validated.rangeStart);
  const rangeEnd = new Date(validated.rangeEnd);

  const poll = await db.availabilityPoll.upsert({
    where: { tripId: validated.tripId },
    create: {
      tripId: validated.tripId,
      rangeStart,
      rangeEnd,
      enabledBlocks: validated.enabledBlocks,
      desiredLengthDays: validated.desiredLengthDays ?? null,
      createdBy: dbUser.id,
    },
    update: {
      rangeStart,
      rangeEnd,
      enabledBlocks: validated.enabledBlocks,
      desiredLengthDays: validated.desiredLengthDays ?? null,
    },
  });

  revalidatePath(`/trips/${validated.tripId}/schedule`);
  return poll;
}

export async function setMySlots(data: SetSlotsInput) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({
    where: { tripId: data.tripId, userId: dbUser.id },
  });
  if (!member) throw new Error("Unauthorized");

  const validated = setSlotsSchema.parse(data);

  await db.$transaction(
    validated.slots.map((slot) => {
      const date = new Date(slot.date);
      return db.availabilitySlot.upsert({
        where: {
          tripId_userId_date_block: {
            tripId: validated.tripId,
            userId: dbUser.id,
            date,
            block: slot.block,
          },
        },
        create: {
          tripId: validated.tripId,
          userId: dbUser.id,
          date,
          block: slot.block,
          status: slot.status,
          source: "manual",
        },
        update: {
          status: slot.status,
          source: "manual",
        },
      });
    })
  );

  revalidatePath(`/trips/${validated.tripId}/schedule`);
}

export async function applyWindow(data: ApplyWindowInput) {
  const dbUser = await getDbUser();
  const member = await db.tripMember.findFirst({
    where: { tripId: data.tripId, userId: dbUser.id, role: "owner" },
  });
  if (!member) throw new Error("Unauthorized");

  const validated = applyWindowSchema.parse(data);

  const poll = await db.availabilityPoll.findUnique({
    where: { tripId: validated.tripId },
  });
  if (!poll) throw new Error("No availability poll exists for this trip");

  const start = new Date(validated.startDate);
  const end = new Date(validated.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (start > end) throw new Error("Window start must be on or before window end");

  // Validate window is within the poll range.
  const rangeStart = new Date(poll.rangeStart);
  const rangeEnd = new Date(poll.rangeEnd);
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(0, 0, 0, 0);
  if (start < rangeStart || end > rangeEnd) {
    throw new Error("Selected window is outside the poll range");
  }

  await db.trip.update({
    where: { id: validated.tripId },
    data: { startDate: start, endDate: end },
  });

  // Reconcile Day rows for the new range — mirror createTrip's day loop.
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (current <= endDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Create missing Day rows (skipDuplicates respects @@unique([tripId, date])).
  await db.day.createMany({
    data: days.map((d) => ({ tripId: validated.tripId, date: d })),
    skipDuplicates: true,
  });

  // Delete Day rows that fall outside the new range.
  await db.day.deleteMany({
    where: {
      tripId: validated.tripId,
      OR: [{ date: { lt: start } }, { date: { gt: end } }],
    },
  });

  revalidatePath(`/trips/${validated.tripId}/itinerary`);
  revalidatePath(`/trips/${validated.tripId}/schedule`);
}
