/**
 * Pure best-window computation for the Schedule poll (ODY-034/109/110).
 * Extracted from schedule/actions.ts so it's testable without a live db.
 */
import type { AvailabilityBlock, AvailabilityStatus } from "@/types";

export type WindowPollInput = {
  rangeStart: Date | string;
  rangeEnd: Date | string;
  enabledBlocks: AvailabilityBlock[];
  desiredLengthDays: number | null;
};

export type WindowSlotInput = {
  userId: string;
  date: Date | string;
  block: AvailabilityBlock;
  status: AvailabilityStatus;
};

export type BestWindow = {
  startDate: string;
  endDate: string;
  score: number;
  /** Distinct travelers marked "available" on every day of the window
   * (ODY-110 — previously summed each day's count, which could exceed the
   * trip's member count on a multi-day window). */
  availableCount: number;
};

function toDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function computeBestWindow(
  poll: WindowPollInput,
  slots: WindowSlotInput[]
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

  // Per-date score and the set of distinct "available" users across enabled blocks.
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
    return { date: d, score, availableUsers };
  });

  const windowLen = Math.max(1, poll.desiredLengthDays ?? 1);
  if (windowLen > perDate.length) return null;

  let best: BestWindow | null = null;
  for (let i = 0; i + windowLen <= perDate.length; i++) {
    let score = 0;
    // Intersect availability across the window: "available" means free
    // every day of the window, not just free on any one day of it — the
    // count this produces can never exceed the trip's member count.
    let intersection: Set<string> | null = null;
    for (let j = i; j < i + windowLen; j++) {
      score += perDate[j].score;
      if (intersection === null) {
        intersection = new Set(perDate[j].availableUsers);
      } else {
        for (const u of intersection) {
          if (!perDate[j].availableUsers.has(u)) intersection.delete(u);
        }
      }
    }
    if (best === null || score > best.score) {
      best = {
        startDate: toDateKey(perDate[i].date),
        endDate: toDateKey(perDate[i + windowLen - 1].date),
        score,
        availableCount: intersection ? intersection.size : 0,
      };
    }
  }

  return best;
}
