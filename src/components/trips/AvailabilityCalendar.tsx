"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { applyWindow, deleteMySlot, setMySlots } from "@/app/trips/[tripId]/schedule/actions";
import { toast } from "@/components/shared/Toast";
import type { GetScheduleResult } from "@/app/trips/[tripId]/schedule/actions";
import { Icons } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import { toDateKey } from "./scheduleShared";

type Poll = NonNullable<GetScheduleResult["poll"]>;
type PaintState = "available" | "unavailable" | "unset";

interface AvailabilityCalendarProps {
  poll: Poll;
  slots: GetScheduleResult["slots"];
  members: GetScheduleResult["members"];
  bestWindow: GetScheduleResult["bestWindow"];
  currentUserId: string;
  isOwner: boolean;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function fmtWindow(key: string): string {
  return new Date(key + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

/** The calendar days (Sun–Sat, whole weeks) covering the poll's date range, so
 *  it reads like a real month even when the range starts mid-week. */
function calendarDays(rangeStart: Date | string, rangeEnd: Date | string): Date[] {
  const start = new Date(rangeStart); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(rangeEnd); end.setUTCHours(0, 0, 0, 0);
  const cur = new Date(start); cur.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const gridEnd = new Date(end); gridEnd.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const days: Date[] = [];
  while (cur <= gridEnd) { days.push(new Date(cur)); cur.setUTCDate(cur.getUTCDate() + 1); }
  return days;
}

function monthCaption(rangeStart: Date | string, rangeEnd: Date | string): string {
  const opt: Intl.DateTimeFormatOptions = { month: "long", year: "numeric", timeZone: "UTC" };
  const s = new Date(rangeStart).toLocaleDateString("en-US", opt);
  const e = new Date(rangeEnd).toLocaleDateString("en-US", opt);
  return s === e ? s : `${new Date(rangeStart).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} – ${e}`;
}

export function AvailabilityCalendar({
  poll, slots, members, bestWindow, currentUserId, isOwner,
}: AvailabilityCalendarProps) {
  // Whole-day poll → a single block ("all_day"). Everything paints that block.
  const block = poll.enabledBlocks[0];
  const totalMembers = members.length;

  const days = useMemo(() => calendarDays(poll.rangeStart, poll.rangeEnd), [poll.rangeStart, poll.rangeEnd]);
  const start = useMemo(() => { const d = new Date(poll.rangeStart); d.setUTCHours(0, 0, 0, 0); return d; }, [poll.rangeStart]);
  const end = useMemo(() => { const d = new Date(poll.rangeEnd); d.setUTCHours(0, 0, 0, 0); return d; }, [poll.rangeEnd]);

  // Your own availability, keyed by dateKey. Absent = not answered.
  const [statuses, setStatuses] = useState<Record<string, "available" | "unavailable">>(() => {
    const seed: Record<string, "available" | "unavailable"> = {};
    for (const s of slots) {
      if (s.userId !== currentUserId || s.block !== block) continue;
      if (s.status === "available" || s.status === "unavailable") seed[toDateKey(s.date)] = s.status;
    }
    return seed;
  });

  // How many distinct travelers are free per day (group heat).
  const groupFree = useMemo(() => {
    const byDate = new Map<string, Set<string>>();
    for (const s of slots) {
      if (s.block !== block || s.status !== "available") continue;
      const key = toDateKey(s.date);
      let set = byDate.get(key);
      if (!set) { set = new Set(); byDate.set(key, set); }
      set.add(s.userId);
    }
    const out: Record<string, number> = {};
    for (const [key, set] of byDate) out[key] = set.size;
    return out;
  }, [slots, block]);

  const notResponded = useMemo(() => {
    const responded = new Set(slots.map((s) => s.userId));
    return members.filter((m) => !responded.has(m.userId));
  }, [slots, members]);

  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Drag-to-paint ────────────────────────────────────────────────────────
  const painting = useRef(false);
  const paintState = useRef<PaintState | null>(null);
  const snapshot = useRef<Record<string, "available" | "unavailable">>({});
  const changed = useRef<Set<string>>(new Set());

  function nextState(cur: "available" | "unavailable" | undefined): PaintState {
    if (!cur) return "available";
    if (cur === "available") return "unavailable";
    return "unset";
  }

  function paintCell(dateKey: string) {
    setStatuses((s) => {
      const n = { ...s };
      if (paintState.current === "unset") delete n[dateKey];
      else if (paintState.current) n[dateKey] = paintState.current;
      return n;
    });
    changed.current.add(dateKey);
  }

  function onDown(dateKey: string) {
    snapshot.current = statuses;
    changed.current = new Set();
    paintState.current = nextState(statuses[dateKey]);
    painting.current = true;
    paintCell(dateKey);
  }
  function onEnter(dateKey: string) {
    if (!painting.current) return;
    paintCell(dateKey);
  }

  // Commit the whole drag in one save (fill) or one delete-per-cleared-cell.
  // Reads drag state from refs, so it stays stable across renders.
  const commit = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    const cells = [...changed.current];
    const state = paintState.current;
    paintState.current = null;
    if (cells.length === 0 || !state) return;
    const snap = snapshot.current;
    startTransition(async () => {
      try {
        if (state === "unset") {
          await Promise.all(cells.map((date) => deleteMySlot({ tripId: poll.tripId, date, block })));
        } else {
          await setMySlots({ tripId: poll.tripId, slots: cells.map((date) => ({ date, block, status: state })) });
        }
      } catch {
        toast("Couldn't save that — try again.");
        setStatuses(snap);
      }
    });
  }, [poll.tripId, block]);
  useEffect(() => {
    const up = () => commit();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [commit]);

  function confirmApply() {
    if (!bestWindow) return;
    startTransition(async () => {
      try {
        await applyWindow({ tripId: poll.tripId, startDate: bestWindow.startDate, endDate: bestWindow.endDate });
        setConfirmOpen(false);
        toast("Trip dates updated.", "success");
      } catch {
        toast("Couldn't apply those dates — try again.");
      }
    });
  }

  const windowDays = bestWindow
    ? Math.round(
        (new Date(bestWindow.endDate + "T00:00:00Z").getTime() -
          new Date(bestWindow.startDate + "T00:00:00Z").getTime()) / 86400000
      ) + 1
    : 0;

  return (
    <section className="cat-block av-block" aria-label="Availability">
      <div className="cat-body av-cal">
        {/* The answer, up top */}
        {bestWindow ? (
          <div className="av-cal-hero">
            <div>
              <div className="av-cal-hero-k">Best window · {totalMembers} traveler{totalMembers === 1 ? "" : "s"}</div>
              <div className="av-cal-hero-dates">{fmtWindow(bestWindow.startDate)} – {fmtWindow(bestWindow.endDate)}</div>
              <div className="av-cal-hero-count">
                {bestWindow.availableCount} of {totalMembers} free{windowDays > 1 ? ` all ${windowDays} days` : ""}
              </div>
            </div>
            {isOwner && (
              <button type="button" className="btn-cta" onClick={() => setConfirmOpen(true)} disabled={isPending}>
                <Icons.schedule size={14} /> Lock these dates
              </button>
            )}
          </div>
        ) : (
          <div className="av-empty">No availability marked yet — paint the days you&apos;re free below.</div>
        )}

        <div className="av-cal-lead">
          <h2 className="av-cal-title">Your availability</h2>
          <p className="av-cal-sub">Drag across days to mark yourself free or busy. Saves as you go.</p>
        </div>

        <div className="av-cal-legend">
          <span><span className="sw sw-free" /> Free</span>
          <span><span className="sw sw-busy" /> Busy</span>
          <span><span className="sw sw-unset" /> Not answered</span>
        </div>

        <div className="av-cal-monthcap">{monthCaption(poll.rangeStart, poll.rangeEnd)}</div>

        <div className="av-cal-grid" role="grid" aria-label="Availability calendar">
          {DOW.map((d, i) => (
            <div key={`dow-${i}`} className="av-cal-dow" aria-hidden="true">{d}</div>
          ))}
          {days.map((date) => {
            const dateKey = toDateKey(date);
            const inRange = date >= start && date <= end;
            const mine = statuses[dateKey];
            const free = groupFree[dateKey] ?? 0;
            const ratio = totalMembers > 0 ? free / totalMembers : 0;
            const dayNum = date.getUTCDate();
            const label = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
            if (!inRange) {
              return <div key={dateKey} className="av-cal-day out" aria-hidden="true"><span className="av-cal-num">{dayNum}</span></div>;
            }
            const stateClass = mine === "available" ? " free" : mine === "unavailable" ? " busy" : "";
            return (
              <button
                key={dateKey}
                type="button"
                role="gridcell"
                className={`av-cal-day pick${stateClass}`}
                onPointerDown={(e) => { e.preventDefault(); onDown(dateKey); }}
                onPointerEnter={() => onEnter(dateKey)}
                aria-label={`${label}: ${mine === "available" ? "free" : mine === "unavailable" ? "busy" : "not answered"}. ${free} of ${totalMembers} travelers free.`}
              >
                <span className="av-cal-num">{dayNum}</span>
                {mine ? (
                  <span className="av-cal-mine">{mine === "available" ? "Free" : "Busy"}</span>
                ) : (
                  <span className="av-cal-grp">{free > 0 ? `${free} free` : ""}</span>
                )}
                {!mine && (
                  <span className="av-cal-heat" aria-hidden="true">
                    <i style={{ "--w": `${Math.round(ratio * 100)}%` } as React.CSSProperties} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="av-cal-roster">
          {notResponded.length > 0
            ? <>Waiting on <b>{notResponded.map((m) => m.user.name).join(", ")}</b>.</>
            : <>Everyone has weighed in.</>}
        </div>
      </div>

      {bestWindow && (
        <Modal open={confirmOpen} onClose={() => { if (!isPending) setConfirmOpen(false); }} ariaLabel="Apply best window to trip dates">
          <div className="modal-head">
            <div className="left">
              <h3>Lock these dates?</h3>
              <p>{fmtWindow(bestWindow.startDate)} – {fmtWindow(bestWindow.endDate)}</p>
            </div>
            <button className="icon-btn" onClick={() => setConfirmOpen(false)} aria-label="Close" disabled={isPending}>
              <Icons.close size={16} />
            </button>
          </div>
          <div className="modal-body">
            <p className="confirm-copy">
              Empty days outside the new range are removed. Days that already have
              events are kept — they&apos;ll just sit outside your trip dates, so
              nothing you&apos;ve planned is deleted.
            </p>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={isPending}>Cancel</button>
            <button className="btn btn-primary" onClick={confirmApply} disabled={isPending}>
              {isPending ? "Applying…" : "Lock dates"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
