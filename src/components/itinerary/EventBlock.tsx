"use client";

import { useState } from "react";
import { AddEventModal } from "./AddEventModal";
import type { TripEvent } from "@/types";

const TYPE_COLOR_VAR: Record<string, string> = {
  flight:     "var(--coral)",
  hotel:      "var(--gold)",
  restaurant: "var(--peach)",
  activity:   "var(--teal)",
  transport:  "var(--peri)",
  misc:       "var(--slate)",
};

interface EventBlockProps {
  event: TripEvent;
  tripId: string;
  isDragging?: boolean;
  dragHandle?: React.ReactNode;
}

export function EventBlock({ event, tripId, isDragging, dragHandle }: EventBlockProps) {
  const [editOpen, setEditOpen] = useState(false);
  const typeColor = TYPE_COLOR_VAR[event.type] ?? "var(--slate)";

  return (
    <>
      <div
        className={`event-row${isDragging ? " od-dragging" : ""}`}
        style={{ "--type-color": typeColor } as React.CSSProperties}
      >
        <div className={`event-card t-${event.type}`}>
          <div className="event-top">
            {dragHandle}

            {/* Time column */}
            <div className="event-time">
              <span>{event.startTime || "—"}</span>
              {event.endTime && <span className="end">→ {event.endTime}</span>}
            </div>

            {/* Main content */}
            <div className="event-main">
              <div className="event-headline">
                {/* Type badge */}
                <span className={`od-badge t-${event.type}`}>
                  {event.type}
                </span>

                <h4 className="event-title">{event.title}</h4>

                {/* Actions (hover-reveal) */}
                <div className="event-actions">
                  <button
                    className="icon-btn"
                    title="Edit event"
                    aria-label="Edit event"
                    onClick={() => setEditOpen(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sub-row: location + cost */}
              {(event.location || event.cost != null) && (
                <div className="event-sub">
                  {event.location && (
                    <span className="meta">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      {event.location}
                    </span>
                  )}
                  {event.cost != null && (
                    <span className="cost">
                      ${Number(event.cost).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              )}

              {/* Notes */}
              {event.notes && (
                <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.5, fontStyle: "italic" }}>
                  {event.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <AddEventModal
        open={editOpen}
        tripId={tripId}
        dayId={event.dayId}
        dayLabel=""
        existing={event}
        onClose={() => setEditOpen(false)}
        onSuccess={() => setEditOpen(false)}
      />
    </>
  );
}
