"use client";

import { useState, useTransition } from "react";
import { AddEventModal } from "./AddEventModal";
import { deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { Icons } from "@/components/shared/Icons";
import type { TripEvent } from "@/types";

const TYPE_VAR: Record<string, string> = {
  flight: "coral",
  hotel: "gold",
  restaurant: "peach",
  activity: "teal",
  transport: "peri",
  misc: "slate",
};

interface EventBlockProps {
  event: TripEvent;
  tripId: string;
  isDragging?: boolean;
  dragHandle?: React.ReactNode;
}

export function EventBlock({ event, tripId, isDragging, dragHandle }: EventBlockProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const typeColor = `var(--${TYPE_VAR[event.type] ?? "slate"})`;

  function handleDelete() {
    startTransition(async () => {
      await deleteEvent(event.id);
    });
  }

  return (
    <>
      <div
        className={`event-row${isDragging ? " dragging" : ""}`}
        style={{ "--type-color": typeColor } as React.CSSProperties}
      >
        <div className={`event-card t-${event.type}`}>
          <div className="event-top">
            {dragHandle}

            <div className="event-time">
              <span>{event.startTime || "—"}</span>
              {event.endTime && <span className="end">→ {event.endTime}</span>}
            </div>

            <div className="event-main">
              <div className="event-headline">
                <TypeBadge type={event.type} />
                <h4 className="event-title">{event.title}</h4>
                <div className="event-actions">
                  <button className="icon-btn" title="Edit event" aria-label="Edit event" onClick={() => setEditOpen(true)}>
                    <Icons.edit size={14} />
                  </button>
                  <button className="icon-btn danger" title="Delete event" aria-label="Delete event" onClick={handleDelete} disabled={isPending}>
                    <Icons.trash size={14} />
                  </button>
                </div>
              </div>

              {(event.location || event.cost != null) && (
                <div className="event-sub">
                  {event.location && (
                    <span className="meta">
                      <Icons.pin size={12} />{" "}
                      {(event.type === "flight" || event.type === "transport") && event.destLocation
                        ? `${event.location} → ${event.destLocation}`
                        : event.location}
                    </span>
                  )}
                  {event.cost != null && (
                    <span className="cost">${Number(event.cost).toLocaleString("en-US")}</span>
                  )}
                </div>
              )}

              {event.notes && (
                <div className="event-notes">
                  <span className="icon"><Icons.note size={12} /></span>
                  <span style={{ flex: 1 }}>{event.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
