"use client";

import { useState, useTransition } from "react";
import { AddEventModal } from "./AddEventModal";
import { deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";
import type { TripEvent } from "@/types";
import { parseNoteChunks } from "@/lib/notes";

const TYPE_VAR: Record<string, string> = {
  flight: "coral",
  hotel: "gold",
  restaurant: "peach",
  activity: "teal",
  transport: "peri",
  misc: "slate",
};

/**
 * Display-only notes formatting (ODY-039): storage stays the plain string;
 * parsing lives in lib/notes.ts (unit-tested). Text nodes only — note content
 * is never parsed as HTML.
 */
function NotesBody({ text }: { text: string }) {
  const chunks = parseNoteChunks(text);

  if (!chunks) return <span className="notes-body">{text}</span>;

  return (
    <span className="notes-body">
      {chunks.map((c, i) =>
        c.kind === "ul" ? (
          <ul key={i}>
            {c.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{c.text}</p>
        )
      )}
    </span>
  );
}

interface EventBlockProps {
  event: TripEvent;
  tripId: string;
  isDragging?: boolean;
  dragHandle?: React.ReactNode;
  /** Viewers see events without edit/delete controls (ODY-001). */
  readOnly?: boolean;
}

export function EventBlock({ event, tripId, isDragging, dragHandle, readOnly = false }: EventBlockProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const typeColor = `var(--${TYPE_VAR[event.type] ?? "slate"})`;

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteEvent(event.id);
      } catch {
        toast(`Couldn't delete "${event.title}" — try again.`);
      }
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
                {!readOnly && (
                  <div className="event-actions">
                    <button className="icon-btn" title="Edit event" aria-label="Edit event" onClick={() => setEditOpen(true)}>
                      <Icons.edit size={14} />
                    </button>
                    <button className="icon-btn danger" title="Delete event" aria-label="Delete event" onClick={handleDelete} disabled={isPending}>
                      <Icons.trash size={14} />
                    </button>
                  </div>
                )}
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
                  <NotesBody text={event.notes} />
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
