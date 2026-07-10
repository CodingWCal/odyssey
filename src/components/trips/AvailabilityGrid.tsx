"use client";

import { useMemo, useState, useTransition } from "react";
import { setMySlots } from "@/app/trips/[tripId]/schedule/actions";
import type { GetScheduleResult } from "@/app/trips/[tripId]/schedule/actions";
import type { AvailabilityBlock, AvailabilityStatus } from "@/types";
import { BLOCK_LABEL, eachDay, formatDayLabel, toDateKey } from "./scheduleShared";

type Poll = NonNullable<GetScheduleResult["poll"]>;

interface AvailabilityGridProps {
  poll: Poll;
  slots: GetScheduleResult["slots"];
  members: GetScheduleResult["members"];
  currentUserId: string;
}

// empty -> available -> maybe -> unavailable -> empty
const CYCLE: Record<string, AvailabilityStatus | undefined> = {
  empty: "available",
  available: "maybe",
  maybe: "unavailable",
  unavailable: undefined, // back to empty
};

// Status → .av-cell-btn variant class in globals.css.
function cellClass(status: AvailabilityStatus | undefined): string {
  if (status === "available") return "is-available";
  if (status === "maybe") return "is-maybe";
  return "is-unset";
}

function cellLabel(status: AvailabilityStatus | undefined): string {
  if (status === "available") return "Free";
  if (status === "maybe") return "Maybe";
  if (status === "unavailable") return "Busy";
  return "";
}

export function AvailabilityGrid({ poll, slots, currentUserId }: AvailabilityGridProps) {
  const dates = useMemo(() => eachDay(poll.rangeStart, poll.rangeEnd), [poll.rangeStart, poll.rangeEnd]);
  const blocks = poll.enabledBlocks;

  // Seed local state from the current user's slots. Key = `${dateKey}|${block}`.
  const [statuses, setStatuses] = useState<Record<string, AvailabilityStatus>>(() => {
    const seed: Record<string, AvailabilityStatus> = {};
    for (const s of slots) {
      if (s.userId !== currentUserId) continue;
      seed[`${toDateKey(s.date)}|${s.block}`] = s.status;
    }
    return seed;
  });

  const [, startTransition] = useTransition();

  function persist(next: Record<string, AvailabilityStatus>) {
    const payload = Object.entries(next).map(([key, status]) => {
      const [date, block] = key.split("|");
      return { date, block: block as AvailabilityBlock, status };
    });
    startTransition(async () => {
      try {
        await setMySlots({ tripId: poll.tripId, slots: payload });
      } catch {
        // swallow — optimistic state stays; revalidation will reconcile.
      }
    });
  }

  function cycle(dateKey: string, block: AvailabilityBlock) {
    const key = `${dateKey}|${block}`;
    const current = statuses[key];
    const nextStatus = CYCLE[current ?? "empty"];
    const next = { ...statuses };
    if (nextStatus === undefined) delete next[key];
    else next[key] = nextStatus;
    setStatuses(next);
    persist(next);
  }

  return (
    <section className="cat-block av-block">
      <header className="cat-head av-head">
        <div>
          <h2 className="cat-title">Your availability</h2>
          <div className="cat-meta">Tap a cell to cycle: free → maybe → busy → clear. Saves automatically.</div>
        </div>
      </header>

      <div className="cat-body av-body">
        <div className="av-legend">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded av-sw-free" /> Free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded av-sw-maybe" /> Maybe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded av-sw-busy" /> Busy / unset
          </span>
        </div>

        <table className="w-full border-separate av-table">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium av-th" />
              {blocks.map((block) => (
                <th key={block} className="text-xs font-medium text-center av-th-block">
                  {BLOCK_LABEL[block]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const dateKey = toDateKey(date);
              const { weekday, day } = formatDayLabel(date);
              return (
                <tr key={dateKey}>
                  <th className="text-left whitespace-nowrap pr-2 av-th-day">
                    <span className="block text-xs uppercase tracking-wide week">{weekday}</span>
                    <span className="block text-sm font-medium">{day}</span>
                  </th>
                  {blocks.map((block) => {
                    const status = statuses[`${dateKey}|${block}`];
                    return (
                      <td key={block} className="text-center">
                        <button
                          type="button"
                          onClick={() => cycle(dateKey, block)}
                          className={`w-full rounded-lg text-xs font-medium transition-colors av-cell-btn ${cellClass(status)}`}
                          aria-label={`${weekday} ${day} ${BLOCK_LABEL[block]}: ${cellLabel(status) || "unset"}`}
                        >
                          {cellLabel(status)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
