"use client";

import { useState, useTransition } from "react";
import { AddEventModal } from "./AddEventModal";
import { deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { Icons } from "@/components/shared/Icons";
import { RouteLine } from "@/components/shared/RouteLine";
import { toast } from "@/components/shared/Toast";
import type { TripEvent } from "@/types";
import { parseNoteChunks } from "@/lib/notes";
import { formatTime, type TimeFormat } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

const TYPE_VAR: Record<string, string> = {
  flight: "coral",
  hotel: "gold",
  restaurant: "peach",
  activity: "teal",
  transport: "peri",
  misc: "slate",
};

/** A note is "long" past this length even without line breaks (ODY-040). */
const NOTE_COLLAPSE_CHARS = 140;

/**
 * Event note display (ODY-039/040): storage stays the plain string; parsing
 * lives in lib/notes.ts (unit-tested). Multi-line notes render as bullets/
 * paragraphs; long notes collapse to their first line with a toggle so busy
 * days don't bloat the page. Text nodes only — never parsed as HTML.
 */
function EventNotes({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const chunks = parseNoteChunks(text);
  const isLong = chunks !== null || text.length > NOTE_COLLAPSE_CHARS;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const preview = (lines[0] ?? "").replace(/^[-*•]\s*/, "");
  const lineCount = lines.length;

  return (
    <div className="event-notes">
      <span className="icon"><Icons.note size={12} /></span>
      <span className="notes-body">
        {!isLong ? (
          text
        ) : open ? (
          chunks ? (
            chunks.map((c, i) =>
              c.kind === "ul" ? (
                <ul key={i}>
                  {c.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{c.text}</p>
              )
            )
          ) : (
            text
          )
        ) : (
          <span className="notes-preview">{preview}</span>
        )}
        {isLong && (
          <button
            type="button"
            className="notes-toggle"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? "Show less" : lineCount > 1 ? `Show note · ${lineCount} lines` : "Show more"}
          </button>
        )}
      </span>
    </div>
  );
}

interface EventBlockProps {
  event: TripEvent;
  tripId: string;
  isDragging?: boolean;
  dragHandle?: React.ReactNode;
  /** Viewers see events without edit/delete controls (ODY-001). */
  readOnly?: boolean;
  /** Trip-level 12h/24h display preference (ODY-041). */
  timeFormat?: TimeFormat;
  /** Trip base currency for cost display (ODY-024). */
  currency?: string;
  /** Trip destination — biases location search toward it (ODY-091). */
  destination?: string;
  /** Soft overlap titles for this event (ODY-077). */
  overlapWith?: string[];
}

export function EventBlock({ event, tripId, isDragging, dragHandle, readOnly = false, timeFormat = "12h", currency = "USD", destination, overlapWith }: EventBlockProps) {
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
              <span>{event.startTime ? formatTime(event.startTime, timeFormat) : "—"}</span>
              {event.endTime && <span className="end">→ {formatTime(event.endTime, timeFormat)}</span>}
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
                    (event.type === "flight" || event.type === "transport") && event.destLocation ? (
                      <span className="meta event-route">
                        <Icons.pin size={12} />
                        <RouteLine from={event.location} to={event.destLocation} />
                      </span>
                    ) : (
                      <span className="meta">
                        <Icons.pin size={12} /> {event.location}
                      </span>
                    )
                  )}
                  {event.cost != null && (
                    <span className="cost">{formatMoney(event.cost, currency)}</span>
                  )}
                </div>
              )}

              {(event.confirmationCode || event.bookingUrl || event.checkIn) && (
                <div className="event-booking">
                  {event.checkIn && (
                    <span className="eb-item"><Icons.clock size={12} /> {event.checkIn}</span>
                  )}
                  {event.confirmationCode && (
                    <span className="eb-item eb-conf" title="Confirmation number">#{event.confirmationCode}</span>
                  )}
                  {event.bookingUrl && (
                    <a className="eb-item eb-link" href={event.bookingUrl} target="_blank" rel="noopener noreferrer">
                      Reservation ↗
                    </a>
                  )}
                </div>
              )}

              {event.notes && (
                <EventNotes text={event.notes} />
              )}
              {overlapWith && overlapWith.length > 0 && (
                <p className="event-overlap">
                  Overlaps {overlapWith.join(", ")}
                </p>
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
        destination={destination}
        onClose={() => setEditOpen(false)}
        onSuccess={() => setEditOpen(false)}
      />
    </>
  );
}
