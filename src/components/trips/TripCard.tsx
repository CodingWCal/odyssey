"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarStack } from "@/components/shared/AvatarStack";
import { Icons } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import { toast } from "@/components/shared/Toast";
import { formatMoney } from "@/lib/money";
import { duplicateTrip } from "@/app/trips/actions";
import { COVER_ACCENT } from "./cover";

export interface DashTrip {
  id: string;
  title: string;
  destination: string;
  startStr: string;
  endStr: string;
  /** Raw start date as "YYYY-MM-DD" — seeds the duplicate-trip date picker (ODY-033). */
  startISO: string;
  days: number;
  spent: number;
  cost: number;
  currency: string;
  status: "live" | "upcoming" | "past";
  countdown: string;
  cover: string;
  members: { id: string; name: string }[];
  /** Soft-hidden from *this* member's dashboard (ODY-082, per-member). */
  archived: boolean;
}

function titleParts(title: string): { head: string; tail: string } {
  const m = title.match(/^(.*?)(\s+\S+)$/);
  if (!m) return { head: "", tail: title };
  return { head: m[1], tail: m[2] };
}

export function TripCard({ trip, onArchiveToggle }: { trip: DashTrip; onArchiveToggle?: (id: string, archived: boolean) => void }) {
  const router = useRouter();
  const isPast = trip.status === "past";
  const { head, tail } = titleParts(trip.title);

  const [menuOpen, setMenuOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [newStart, setNewStart] = useState(trip.startISO);
  const [busy, startDup] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Keyboard operability for the actions menu (ODY-118 F3): focus the first
  // item on open, and Escape closes + returns focus to the trigger. The items
  // are plain buttons, so Tab moves between them.
  useEffect(() => {
    if (!menuOpen) return;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Any member can archive their own view. The control shows on archived trips
  // (Restore) and on past active trips (Archive — the ones that pile up);
  // upcoming/live active cards stay uncluttered (ODY-082).
  const showArchive = Boolean(onArchiveToggle) && (trip.archived || isPast);

  function closeMenu() {
    setMenuOpen(false);
  }

  function openDuplicate() {
    closeMenu();
    setNewStart(trip.startISO);
    setDupOpen(true);
  }

  function handleArchive() {
    closeMenu();
    onArchiveToggle?.(trip.id, trip.archived);
  }

  function submitDuplicate() {
    startDup(async () => {
      try {
        const { tripId } = await duplicateTrip(trip.id, newStart || undefined);
        toast("Trip duplicated.");
        router.push(`/trips/${tripId}/itinerary`);
      } catch {
        toast("Couldn't duplicate that trip — try again.");
      }
    });
  }

  return (
    <div className={`trip-card ${isPast ? "past" : ""}`}>
      {/* The whole cover + body is the link; display:contents keeps it inside
          the card's flex layout. The actions menu and modal are siblings, not
          descendants of the anchor, so their clicks never trigger navigation. */}
      <Link href={`/trips/${trip.id}/itinerary`} className="trip-card-link">
        <div
          className="cover cover-art"
          style={{ "--cover-img": `${COVER_ACCENT}, ${trip.cover}` } as React.CSSProperties}
        >
          <span className="countdown">{trip.countdown}</span>
          <div className="cover-bottom">
            <div className="dest">{trip.destination}</div>
            <div className="days">{trip.days} days</div>
          </div>
        </div>
        <div className="body">
          <h3>{head}<em>{tail}</em></h3>
          <div className="dates">{trip.startStr} → {trip.endStr}</div>
          <div className="meta">
            <AvatarStack members={trip.members} />
            <span className="cost">
              {isPast
                ? <>{formatMoney(trip.spent, trip.currency)} <span className="muted-spent">spent</span></>
                : trip.spent > 0
                  ? <>{formatMoney(trip.spent, trip.currency)} / {formatMoney(trip.cost, trip.currency)}</>
                  : <>{formatMoney(trip.cost, trip.currency)} budget</>}
            </span>
          </div>
        </div>
      </Link>

      <div className="trip-card-menu">
        <button
          ref={triggerRef}
          type="button"
          className="trip-card-menu-btn"
          aria-label="Trip actions"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icons.more size={16} />
        </button>
        {menuOpen && (
          <>
            <div className="trip-card-menu-scrim" onClick={closeMenu} aria-hidden="true" />
            <div ref={panelRef} className="trip-card-menu-panel" aria-label="Trip actions">
              <button type="button" className="tcm-item" onClick={openDuplicate}>
                <Icons.copy size={14} /> Duplicate trip
              </button>
              {showArchive && (
                <button type="button" className="tcm-item" onClick={handleArchive}>
                  {trip.archived ? "Restore to dashboard" : "Archive"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <Modal open={dupOpen} onClose={() => setDupOpen(false)} ariaLabel="Duplicate trip">
        <div className="modal-head">
          <div className="left">
            <h3>Duplicate trip</h3>
            <p>{trip.title}</p>
          </div>
          <button className="icon-btn" onClick={() => setDupOpen(false)} aria-label="Close">
            <Icons.close size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor={`dup-start-${trip.id}`}>New start date</label>
            <input
              id={`dup-start-${trip.id}`}
              type="date"
              className="input"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
            <p className="field-hint">
              We&rsquo;ll copy every day and event, shifted to start on this date. The {trip.days}-day length stays the same.
            </p>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={() => setDupOpen(false)} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submitDuplicate} disabled={busy || !newStart}>
            {busy ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
