"use client";

import { useState } from "react";
import { AddEventModal } from "./AddEventModal";
import { Icons } from "@/components/shared/Icons";
import type { DayOption, TripEvent } from "@/types";

const PHASE_LABEL: Record<NonNullable<TripEvent["lodgingPhase"]>, string> = {
  "check-in": "Check in",
  staying: "Staying",
  "check-out": "Check out",
};

interface LodgingBannerProps {
  event: TripEvent;
  tripId: string;
  readOnly?: boolean;
  destination?: string;
  /** The trip's days, for the edit form's move-to-day picker (ODY-147). */
  days?: DayOption[];
}

/**
 * All-day banner for a multi-night lodging stay — sits at the top of every
 * day the stay spans (check-in through check-out), like a calendar's
 * all-day event, instead of the normal time-ordered list. Editing opens the
 * same AddEventModal as any event; the underlying Event is single, so
 * editing from any day it spans updates the whole stay.
 */
export function LodgingBanner({ event, tripId, readOnly = false, destination, days }: LodgingBannerProps) {
  const [editOpen, setEditOpen] = useState(false);
  const phase = event.lodgingPhase ?? "staying";

  const content = (
    <>
      <Icons.hotel size={14} />
      <span className="lb-phase">{PHASE_LABEL[phase]}</span>
      <span className="lb-title">{event.title}</span>
      {event.location && <span className="lb-loc">{event.location}</span>}
    </>
  );

  if (readOnly) {
    return (
      <div className={`lodging-banner lp-${phase}`} aria-label={`${PHASE_LABEL[phase]}: ${event.title}`}>
        {content}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`lodging-banner lp-${phase}`}
        onClick={() => setEditOpen(true)}
        aria-label={`Edit ${event.title}, ${PHASE_LABEL[phase].toLowerCase()}`}
      >
        {content}
      </button>

      <AddEventModal
        open={editOpen}
        tripId={tripId}
        dayId={event.dayId}
        dayLabel=""
        dayDate={event.dayDate ?? event.createdAt}
        existing={event}
        destination={destination}
        days={days}
        onClose={() => setEditOpen(false)}
        onSuccess={() => setEditOpen(false)}
      />
    </>
  );
}
