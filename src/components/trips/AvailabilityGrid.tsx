"use client";

import { useMemo, useState, useTransition } from "react";
import { clearMySlots, deleteMySlot, setMySlots } from "@/app/trips/[tripId]/schedule/actions";
import { toast } from "@/components/shared/Toast";
import type { GetScheduleResult } from "@/app/trips/[tripId]/schedule/actions";
import type { AvailabilityBlock, AvailabilityStatus } from "@/types";
import { BLOCK_LABEL, eachDay, fillSlots, formatDayLabel, toDateKey } from "./scheduleShared";

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

// Status → .av-cell-btn variant class in globals.css. "unavailable" (busy)
// and unset must render distinctly (ODY-109) — an explicit "I can't make
// it" is the single most important signal in a scheduling poll, and it
// used to be visually identical to silence.
function cellClass(status: AvailabilityStatus | undefined): string {
  if (status === "available") return "is-available";
  if (status === "maybe") return "is-maybe";
  if (status === "unavailable") return "is-busy";
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
  const dateKeys = useMemo(() => dates.map((d) => toDateKey(d)), [dates]);
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

  // Persist just the cell that changed (ODY-109) — the previous version
  // resent the whole slot map on every tap, so a poll with a wide range or
  // several blocks rewrote every slot on each click.
  function persist(dateKey: string, block: AvailabilityBlock, status: AvailabilityStatus, revert: () => void) {
    startTransition(async () => {
      try {
        await setMySlots({ tripId: poll.tripId, slots: [{ date: dateKey, block, status }] });
      } catch {
        toast("Couldn't save that — try again.");
        revert();
      }
    });
  }

  // Clearing back to "unset" deletes the row rather than just dropping it
  // from local state (ODY-113) — otherwise the last real answer reappeared
  // on next load, since the backend only ever upserted.
  function clear(dateKey: string, block: AvailabilityBlock, revert: () => void) {
    startTransition(async () => {
      try {
        await deleteMySlot({ tripId: poll.tripId, date: dateKey, block });
      } catch {
        toast("Couldn't clear that — try again.");
        revert();
      }
    });
  }

  function cycle(dateKey: string, block: AvailabilityBlock) {
    const key = `${dateKey}|${block}`;
    const previous = statuses[key];
    const nextStatus = CYCLE[previous ?? "empty"];
    const next = { ...statuses };
    if (nextStatus === undefined) delete next[key];
    else next[key] = nextStatus;
    setStatuses(next);

    function revert() {
      setStatuses((s) => {
        const reverted = { ...s };
        if (previous === undefined) delete reverted[key];
        else reverted[key] = previous;
        return reverted;
      });
    }

    if (nextStatus === undefined) clear(dateKey, block, revert);
    else persist(dateKey, block, nextStatus, revert);
  }

  // Bulk "free" fills (ODY-109): one save for a whole day, a whole block
  // column, or the whole range — the poll's biggest time cost when done cell
  // by cell. Optimistic; a failed save reverts to the pre-fill snapshot.
  function fillFree(useDateKeys: string[], useBlocks: AvailabilityBlock[]) {
    const toSave = fillSlots(useDateKeys, useBlocks, "available");
    if (toSave.length === 0) return;
    const snapshot = statuses;
    setStatuses((s) => {
      const next = { ...s };
      for (const slot of toSave) next[`${slot.date}|${slot.block}`] = "available";
      return next;
    });
    startTransition(async () => {
      try {
        await setMySlots({ tripId: poll.tripId, slots: toSave });
      } catch {
        toast("Couldn't save that — try again.");
        setStatuses(snapshot);
      }
    });
  }

  // Clear every one of the caller's slots for the poll (ODY-109). Optimistic;
  // reverts on failure.
  function clearAll() {
    if (Object.keys(statuses).length === 0) return;
    const snapshot = statuses;
    setStatuses({});
    startTransition(async () => {
      try {
        await clearMySlots({ tripId: poll.tripId });
      } catch {
        toast("Couldn't clear that — try again.");
        setStatuses(snapshot);
      }
    });
  }

  return (
    <section className="cat-block av-block">
      <header className="cat-head av-head">
        <div>
          <h2 className="cat-title">Your availability</h2>
          <div className="cat-meta">Tap a cell to cycle: free → maybe → busy → clear. Saves automatically.</div>
        </div>
      </header>

      <div className="av-bulk">
        <span className="av-bulk-label">Quick fill</span>
        <button
          type="button"
          className="av-bulk-btn"
          onClick={() => fillFree(dateKeys, blocks)}
          aria-label="Mark yourself free for the whole range"
        >
          I&rsquo;m free the whole range
        </button>
        <button
          type="button"
          className="av-bulk-btn ghost"
          onClick={clearAll}
          aria-label="Clear all of your availability"
        >
          Clear all
        </button>
      </div>

      <div className="cat-body av-body">
        <div className="av-legend">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded av-sw-free" /> Free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded av-sw-maybe" /> Maybe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded av-sw-busy" /> Busy
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded av-sw-unset" /> Unset
          </span>
        </div>

        <table className="w-full border-separate av-table">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium av-th" />
              {blocks.map((block) => (
                <th key={block} className="text-xs font-medium text-center av-th-block">
                  <button
                    type="button"
                    className="av-col-btn"
                    onClick={() => fillFree(dateKeys, [block])}
                    aria-label={`Mark yourself free every ${BLOCK_LABEL[block]}`}
                  >
                    <span className="av-col-cap">{BLOCK_LABEL[block]}</span>
                    <span className="av-fill-hint">free every day</span>
                  </button>
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
                    <button
                      type="button"
                      className="av-day-btn"
                      onClick={() => fillFree([dateKey], blocks)}
                      aria-label={`Mark yourself free all day on ${weekday} ${day}`}
                    >
                      <span className="block text-xs uppercase tracking-wide week">{weekday}</span>
                      <span className="block text-sm font-medium">{day}</span>
                      <span className="av-fill-hint">whole day free</span>
                    </button>
                  </th>
                  {/* ↑ day label is a button: fills the whole day free (ODY-109) */}
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
