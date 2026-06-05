"use client";

import { useMemo, useTransition } from "react";
import { applyWindow } from "@/app/trips/[tripId]/schedule/actions";
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

  function intensityStyle(count: number): React.CSSProperties {
    if (count === 0 || totalMembers === 0) {
      return { background: "var(--paper-3)", color: "var(--ink-3)", border: "1px solid var(--rule)" };
    }
    const ratio = Math.min(1, count / totalMembers);
    // Teal fill, opacity scaled by share of travelers available.
    const opacity = 0.2 + 0.8 * ratio;
    return {
      background: `color-mix(in srgb, var(--teal) ${Math.round(opacity * 100)}%, var(--paper-2))`,
      color: ratio > 0.5 ? "#fff" : "var(--ink)",
      border: "1px solid var(--rule)",
    };
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
        // revalidation / errors surface on refresh.
      }
    });
  }

  return (
    <section className="cat-block" style={{ padding: 0 }}>
      <header className="cat-head" style={{ cursor: "default" }}>
        <div>
          <h2 className="cat-title">Group availability</h2>
          <div className="cat-meta">
            How many of {totalMembers} traveler{totalMembers === 1 ? "" : "s"} are free in each block.
          </div>
        </div>
      </header>

      <div className="cat-body" style={{ maxHeight: "none", overflowX: "auto", padding: "0 18px 18px" }}>
        {/* Best window card */}
        {bestWindow ? (
          <div
            className="rounded-xl"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "16px 18px",
              margin: "12px 0 18px",
              background: "var(--teal-soft)",
              border: "1px solid var(--rule-2)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                Best window
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)" }}>
                {formatWindowDate(bestWindow.startDate)} – {formatWindowDate(bestWindow.endDate)}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
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
          <div
            style={{
              padding: "28px 18px",
              margin: "12px 0 18px",
              textAlign: "center",
              borderRadius: "var(--radius-lg)",
              background: "var(--paper-2)",
              border: "1px solid var(--rule)",
              color: "var(--ink-3)",
              fontSize: 13,
            }}
          >
            No availability marked yet.
          </div>
        )}

        <table className="w-full border-separate" style={{ borderSpacing: "6px" }}>
          <thead>
            <tr>
              <th className="text-left text-xs font-medium" style={{ color: "var(--ink-3)" }} />
              {blocks.map((block: AvailabilityBlock) => (
                <th
                  key={block}
                  className="text-xs font-medium text-center"
                  style={{ color: "var(--ink-3)", minWidth: 88 }}
                >
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
                  <th className="text-left whitespace-nowrap pr-2" style={{ color: "var(--ink-2)" }}>
                    <span className="block text-xs uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                      {weekday}
                    </span>
                    <span className="block text-sm font-medium">{day}</span>
                  </th>
                  {blocks.map((block: AvailabilityBlock) => {
                    const count = counts[`${dateKey}|${block}`] ?? 0;
                    return (
                      <td key={block} className="text-center">
                        <div
                          className="w-full rounded-lg text-xs font-semibold flex items-center justify-center"
                          style={{ height: 40, minWidth: 80, ...intensityStyle(count) }}
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
