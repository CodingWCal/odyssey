"use client";

import { useState, useTransition } from "react";
import { AddEventModal } from "./AddEventModal";
import { EventChecklist } from "./EventChecklist";
import { deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { Icons } from "@/components/shared/Icons";
import { RouteLine } from "@/components/shared/RouteLine";
import { FlightLegsDisplay } from "./FlightLegsDisplay";
import { toast } from "@/components/shared/Toast";
import type { TripEvent } from "@/types";
import { parseNoteChunks } from "@/lib/notes";
import { formatTime, firstAddressSegment, type TimeFormat } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { flightLegsForDisplay, isOvernightFlight, isOvernightSimple } from "@/lib/flightLegs";

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

/**
 * A single-point location, condensed on mobile (ODY-129): a full geocoded
 * address wraps 2-3 lines on a phone and dominates the card. Mobile shows
 * just the venue/street segment (text before the first comma) with a tap
 * to reveal the rest inline; desktop is unchanged, and a short address (no
 * comma — nothing to shorten) never gets a toggle at all. Transport routes
 * go through RouteLine and flights through leg cards (ODY-144/145) instead;
 * both condense each endpoint the same way via RoutePoint (ODY-143).
 */
function EventLocation({ location }: { location: string }) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const short = firstAddressSegment(location);
  const canShorten = isMobile && short !== location;

  if (!canShorten) {
    return <span className="meta"><Icons.pin size={12} /> {location}</span>;
  }

  return (
    <span className="meta event-location-condensed">
      <Icons.pin size={12} />
      <button
        type="button"
        className="event-location-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {expanded ? location : short}
      </button>
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

  // Every flight with a route renders as leg cards (ODY-144/145), one leg or
  // many — an older flight with no stored legs gets one built from its flat
  // fields. The overnight badge uses the cumulative day-offset check, which
  // also catches a same-day-looking final leg that lands a day later after an
  // overnight layover. A flight with no route to draw keeps the plain
  // location line and falls back to comparing its top-level times.
  const legs = event.type === "flight" ? flightLegsForDisplay(event) : [];
  const hasLegCards = legs.length > 0;
  const overnight =
    event.type === "flight" &&
    (hasLegCards ? isOvernightFlight(legs) : isOvernightSimple(event.startTime, event.endTime));

  function handleDelete() {
    // Confirm before an irreversible delete (ODY mobile polish) — the trash
    // icon is a single tap, easy to hit by accident on a phone. Matches the
    // app's existing destructive-action convention (member removal / leave).
    if (!window.confirm(`Delete "${event.title}"? This can't be undone.`)) return;
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
              {event.endTime && (
                <span className="end">
                  → {formatTime(event.endTime, timeFormat)}
                  {overnight && <sup className="flight-plusday" title="Arrives the next day">+1</sup>}
                </span>
              )}
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
                  {event.location && !hasLegCards && (
                    (event.type === "flight" || event.type === "transport") && event.destLocation ? (
                      <span className="meta event-route">
                        <Icons.pin size={12} />
                        <RouteLine from={event.location} to={event.destLocation} />
                      </span>
                    ) : (
                      <EventLocation location={event.location} />
                    )
                  )}
                  {event.cost != null && (
                    <span className="cost">{formatMoney(event.cost, currency)}</span>
                  )}
                </div>
              )}

              {hasLegCards && <FlightLegsDisplay legs={legs} timeFormat={timeFormat} />}

              {(event.confirmationCode || event.bookingUrl || event.checkIn || event.layover) && (
                <div className="event-booking">
                  {event.layover && (
                    <span className="eb-item" title="Layover">
                      <Icons.transport size={12} /> {event.layover}
                    </span>
                  )}
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
              <EventChecklist
                tripId={tripId}
                eventId={event.id}
                items={event.packingItems ?? []}
                readOnly={readOnly}
              />
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
        dayDate={event.dayDate ?? event.createdAt}
        existing={event}
        destination={destination}
        onClose={() => setEditOpen(false)}
        onSuccess={() => setEditOpen(false)}
      />
    </>
  );
}
