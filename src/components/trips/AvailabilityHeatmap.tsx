"use client";

import { useMemo, useTransition } from "react";
import { applyWindow } from "@/app/trips/[tripId]/schedule/actions";
import { toast } from "@/components/shared/Toast";
import type { GetScheduleResult } from "@/app/trips/[tripId]/schedule/actions";
import type { AvailabilityBlock } from "@/types";
import { Icons } from "@/components/shared/Icons";
import { BLOCK_LABEL, eachDay, formatDayLabel, toDateKey } from "./scheduleShared";

type Poll = NonNullable<GetScheduleResult["poll"]>;

interface AvailabilityHeatmapProps {
  poll: Poll;
  slots: GetScheduleResult["slots"];
  members: GetScheduleResult["members"];
  bestWindow: GetScheduleResult["bestWindow"];
  isOwner: boolean;
}

function formatWindowDate(key: string): string {
  // key is YYYY-MM-DD (UTC calendar day).
  return new Date(key + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AvailabilityHeatmap({ poll, slots, members, bestWindow, isOwner }: AvailabilityHeatmapProps) {
  const dates = useMemo(() => eachDay(poll.rangeStart, poll.rangeEnd), [poll.rangeStart, poll.rangeEnd]);
  const blocks = poll.enabledBlocks;
  const totalMembers = members.length;

  const [isPending, startTransition] = useTransition();

  // Count distinct members marked "available" per date+block (dedupe per member).
  const counts = useMemo(() => {
    const byCell = new Map<string, Set<string>>();
    for (const s of slots) {
      if (s.status !== "available") continue;
      if (!blocks.includes(s.block)) continue;
      const key = `${toDateKey(s.date)}|${s.block}`;
      let set = byCell.get(key);
      if (!set) {
        set = new Set();
        byCell.set(key, set);
      }
      set.add(s.userId);
    }
    const out: Record<string, number> = {};
    for (const [key, set] of byCell) out[key] = set.size;
    return out;
  }, [slots, blocks]);

  // Per-cell intensity passed as CSS custom properties (the documented
  // dynamic-value exception) — consumed by .av-heat in globals.css.
  function intensityVars(count: number): React.CSSProperties {
    if (count === 0 || totalMembers === 0) {
      return { "--cell-bg": "var(--paper-3)", "--cell-fg": "var(--ink-3)" } as React.CSSProperties;
    }
    const ratio = Math.min(1, count / totalMembers);
    // Teal fill, opacity scaled by share of travelers available.
    const opacity = 0.2 + 0.8 * ratio;
    return {
      "--cell-bg": `color-mix(in srgb, var(--teal) ${Math.round(opacity * 100)}%, var(--paper-2))`,
      "--cell-fg": ratio > 0.5 ? "#fff" : "var(--ink)",
    } as React.CSSProperties;
  }

  function handleApply() {
    if (!bestWindow) return;
    const ok = window.confirm(
      `Apply ${formatWindowDate(bestWindow.startDate)} – ${formatWindowDate(bestWindow.endDate)} as the trip dates?\n\n` +
        "Any itinerary days (and the events on them) that fall outside this new range will be permanently removed."
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await applyWindow({
          tripId: poll.tripId,
          startDate: bestWindow.startDate,
          endDate: bestWindow.endDate,
        });
      } catch {
        toast("Couldn't apply those dates — try again.");
      }
    });
  }

  return (
    <section className="cat-block av-block">
      <header className="cat-head av-head">
        <div>
          <h2 className="cat-title">Group availability</h2>
          <div className="cat-meta">
            How many of {totalMembers} traveler{totalMembers === 1 ? "" : "s"} are free in each block.
          </div>
        </div>
      </header>

      <div className="cat-body av-body">
        {/* Best window card */}
        {bestWindow ? (
          <div className="rounded-xl av-best">
            <div>
              <div className="av-best-label">Best window</div>
              <div className="av-best-dates">
                {formatWindowDate(bestWindow.startDate)} – {formatWindowDate(bestWindow.endDate)}
              </div>
              <div className="av-best-count">
                {bestWindow.availableCount} traveler{bestWindow.availableCount === 1 ? "" : "s"} free
              </div>
            </div>
            {isOwner && (
              <button type="button" className="btn-cta" onClick={handleApply} disabled={isPending}>
                <Icons.schedule size={14} /> {isPending ? "Applying…" : "Apply to trip dates"}
              </button>
            )}
          </div>
        ) : (
          <div className="av-empty">No availability marked yet.</div>
        )}

        <table className="w-full border-separate av-table">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium av-th" />
              {blocks.map((block: AvailabilityBlock) => (
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
                  {blocks.map((block: AvailabilityBlock) => {
                    const count = counts[`${dateKey}|${block}`] ?? 0;
                    return (
                      <td key={block} className="text-center">
                        <div
                          className="w-full rounded-lg text-xs font-semibold flex items-center justify-center av-cell av-heat"
                          style={intensityVars(count)}
                          title={`${count} of ${totalMembers} free`}
                        >
                          {count > 0 ? count : ""}
                        </div>
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
