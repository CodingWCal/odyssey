"use client";

import { useState, useRef, useLayoutEffect, useEffect, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDndMonitor, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EventBlock } from "./EventBlock";
import { AddEventModal } from "./AddEventModal";
import { LodgingBanner } from "./LodgingBanner";
import { DayNotes } from "./DayNotes";
import { useItineraryBoard } from "./ItineraryBoard";
import { Modal } from "@/components/shared/Modal";
import { reorderEvents, copyDayEvents, moveEventToDay } from "@/app/trips/[tripId]/itinerary/actions";
import { applyIncomingEvent, dragDataOf, type DayDropData, type EventDragData } from "@/lib/dayDnd";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";
import type { DayOption, TripDay, TripEvent } from "@/types";
import { formatDate, type TimeFormat } from "@/lib/utils";
import { formatWeekday, localDateKey, toDateInputValue } from "@/lib/dates";
import { sortEventsByTime } from "@/lib/sortEvents";
import { deriveDayLocation } from "@/lib/deriveDayLocation";
import { DayLocationLabel } from "./DayLocationLabel";
import { findOverlaps } from "@/lib/eventOverlap";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

const MOBILE_VISIBLE_LIMIT = 5;

function SortableEvent({
  event,
  dayNumber,
  tripId,
  readOnly,
  timeFormat,
  currency,
  destination,
  overlapWith,
  days,
}: {
  event: TripDay["events"][number];
  dayNumber: number;
  tripId: string;
  readOnly?: boolean;
  timeFormat?: TimeFormat;
  currency?: string;
  destination?: string;
  overlapWith?: string[];
  days: DayOption[];
}) {
  const disabled = Boolean(readOnly);
  const data: EventDragData = { type: "event", dayId: event.dayId, dayNumber, event };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
    disabled,
    data,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <EventBlock
        event={event}
        tripId={tripId}
        isDragging={isDragging}
        readOnly={readOnly}
        timeFormat={timeFormat}
        currency={currency}
        destination={destination}
        overlapWith={overlapWith}
        days={days}
        dragHandle={
          disabled ? undefined : (
            <span
              {...listeners}
              className="drag-handle"
              aria-label="Drag to reorder, or onto another day to move it"
              title="Drag to reorder, or onto another day to move it"
            >
              <Icons.drag size={14} />
            </span>
          )
        }
      />
    </div>
  );
}

interface DayBlockProps {
  day: TripDay;
  tripId: string;
  dayNumber: number;
  /** Viewers get a read-only itinerary (ODY-001). */
  readOnly?: boolean;
  /** Trip-level 12h/24h display preference (ODY-041). */
  timeFormat?: TimeFormat;
  /** Trip base currency for cost display (ODY-024). */
  currency?: string;
  /** Trip destination — biases location search toward it (ODY-091). */
  destination?: string;
  /** Roster of the trip's days, so this day can copy its events onto another
   * (ODY-033) and an event can be moved to another (ODY-147). Includes this
   * day; the copy picker filters it out. */
  days?: DayOption[];
  /** Multi-night lodging stays spanning this day (ODY-lodging), each tagged
   * with its check-in/staying/check-out phase — rendered as an all-day
   * banner above the normal timed list, never inside it. */
  allDayEvents?: TripEvent[];
}

export function DayBlock({ day, tripId, dayNumber, readOnly = false, timeFormat = "12h", currency = "USD", destination, days = [], allDayEvents = [] }: DayBlockProps) {
  const router = useRouter();
  const [copyOpen, setCopyOpen] = useState(false);
  const [copying, startCopy] = useTransition();
  const [events, setEvents] = useState(day.events);
  const [addOpen, setAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const isMobile = useIsMobile();
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Client-side "today" (ODY-076): must run in the browser so the traveler's
  // timezone is used — the server (Vercel) is UTC and would mis-label evenings.
  const isToday = toDateInputValue(day.date) === localDateKey();

  // On a live trip, bring today's day into view once on mount (ODY-076).
  // Respect reduced-motion and only scroll for the single "today" block.
  useEffect(() => {
    if (!isToday) return;
    const el = sectionRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep local state in sync with server data after revalidation ("adjust
  // state during render" — replaces the old sync-in-effect + lint disable).
  const eventsSig = useMemo(() => JSON.stringify(day.events), [day.events]);
  const [prevSig, setPrevSig] = useState(eventsSig);
  if (eventsSig !== prevSig) {
    setPrevSig(eventsSig);
    setEvents(day.events);
  }
  // A failed cross-day move (ODY-147) drops every day's optimistic copy and
  // re-reads the server's — the server props didn't change, so the signature
  // check above would never fire on its own.
  const { resyncToken, resync } = useItineraryBoard();
  const [prevResync, setPrevResync] = useState(resyncToken);
  if (resyncToken !== prevResync) {
    setPrevResync(resyncToken);
    setEvents(day.events);
  }

  // Always chronological (ODY-042) — untimed events sort last, ties break on
  // orderIndex, which drag-and-drop can still adjust.
  const displayedEvents = sortEventsByTime(events);
  // Cap a busy day to 5 events on mobile, with a "show more" toggle (ODY-101).
  // Desktop always shows every event.
  const capped = isMobile && !showAllMobile && displayedEvents.length > MOBILE_VISIBLE_LIMIT;
  const visibleEvents = capped ? displayedEvents.slice(0, MOBILE_VISIBLE_LIMIT) : displayedEvents;
  const hiddenCount = displayedEvents.length - visibleEvents.length;
  // Soft conflict hints (ODY-077) — never blocks saving.
  const overlaps = findOverlaps(events);

  // Collapse animation: write max-height straight to the DOM node (external
  // system) instead of routing measured pixels through state.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (collapsed) {
      // Seed a concrete pixel starting point before collapsing to 0 — a
      // transition from "none" (our open resting value) doesn't animate,
      // since "none" isn't an interpolable length (ODY-103).
      el.style.maxHeight = el.scrollHeight + "px";
      const raf = requestAnimationFrame(() => {
        el.style.maxHeight = "0px";
      });
      return () => cancelAnimationFrame(raf);
    } else {
      el.style.maxHeight = el.scrollHeight + "px";
      const t = setTimeout(() => {
        // No fixed ceiling once settled open (ODY-103) — mobile event
        // cards can genuinely exceed any hardcoded cap (long wrapped
        // addresses), and `overflow: hidden` would silently clip
        // whatever renders past it, including the show-more/add-event
        // controls after the event list.
        el.style.maxHeight = "none";
      }, 360);
      return () => clearTimeout(t);
    }
  }, [collapsed, events.length, visibleEvents.length]);

  // The whole day (header + body) is a drop target, so an empty or collapsed
  // day can receive an event dragged from another day (ODY-147).
  const dropData: DayDropData = { type: "day", dayId: day.id, dayNumber };
  const { setNodeRef: setDropRef, isOver, active: activeDrag } = useDroppable({
    id: `day:${day.id}`,
    data: dropData,
    disabled: readOnly,
  });
  const isIncoming = isOver && dragDataOf(activeDrag)?.dayId !== day.id;
  const setSectionRef = useCallback(
    (node: HTMLElement | null) => {
      sectionRef.current = node;
      setDropRef(node);
    },
    [setDropRef]
  );

  // One DndContext spans every day (ItineraryBoard), so each day handles its
  // own side of a drop: reorder within it, or the leaving/arriving half of a
  // cross-day move. Only the leaving day calls the server.
  useDndMonitor({
    onDragEnd(e) {
      const dragged = dragDataOf(e.active);
      const target = dragDataOf(e.over);
      if (dragged?.type !== "event" || !target) return;
      if (dragged.dayId === target.dayId) {
        if (dragged.dayId === day.id) void handleReorder(e);
        return;
      }
      if (dragged.dayId === day.id) void moveOut(dragged.event, target.dayId, target.dayNumber);
      else if (target.dayId === day.id) setEvents((evs) => applyIncomingEvent(evs, dragged.event, day.id, day.date));
    },
  });

  async function moveOut(moved: TripEvent, toDayId: string, toDayNumber: number) {
    setEvents((evs) => evs.filter((ev) => ev.id !== moved.id));
    try {
      await moveEventToDay(moved.id, toDayId);
      toast(`Moved to Day ${String(toDayNumber).padStart(2, "0")}.`, "success");
    } catch {
      resync(); // puts it back here and removes it from the target day
      toast("Couldn't move that event — put it back.");
    }
  }

  async function handleReorder(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleEvents.findIndex((ev) => ev.id === active.id);
    const newIndex = visibleEvents.findIndex((ev) => ev.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const previous = events;
    // Reassign orderIndex from the new drag order; sortEventsByTime uses it
    // as the tie-break, so this only visibly moves same-time/no-time events.
    // Reordering only ever touches the visible (capped) slice — hidden
    // events keep their relative order untouched.
    const reorderedVisible = arrayMove(visibleEvents, oldIndex, newIndex).map((ev, i) => ({ ...ev, orderIndex: i }));
    const reordered = capped
      ? [...reorderedVisible, ...displayedEvents.slice(MOBILE_VISIBLE_LIMIT)]
      : reorderedVisible;
    setEvents(reordered);
    try {
      await reorderEvents(reordered.map((ev, i) => ({ id: ev.id, orderIndex: i })), tripId);
    } catch {
      setEvents(previous); // revert visibly on failure (ODY-013)
      toast("Reorder didn't stick — put back the way it was.");
    }
  }

  // ODY-124: the day heading shows the day's location, not the weekday —
  // the date line right beside it already spells out "Friday, Oct 2".
  // ODY-141: a manual override (Day.label) wins when set — deriveDayLocation
  // can't always guess right on a multi-city trip before events exist.
  const dayLocation = day.label || deriveDayLocation(day, destination);

  // Other days this day's events can be copied onto (ODY-033).
  const copyTargets = days.filter((d) => d.id !== day.id);
  const canCopy = !readOnly && events.length > 0 && copyTargets.length > 0;

  function handleCopyTo(targetDayId: string) {
    startCopy(async () => {
      try {
        await copyDayEvents(day.id, targetDayId, tripId);
        setCopyOpen(false);
        router.refresh();
        toast("Events copied.", "success");
      } catch {
        toast("Couldn't copy those events — try again.");
      }
    });
  }

  return (
    <section
      ref={setSectionRef}
      className={`day-block${collapsed ? " collapsed" : ""}${isToday ? " is-today" : ""}${isIncoming ? " drop-target" : ""}`}
    >
      {/* Keyboard-operable disclosure (ODY-022): Enter/Space toggle, focus ring
          via .day-head:focus-visible; layout unchanged. */}
      <header
        className="day-head"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`Day ${dayNumber}, ${collapsed ? "collapsed" : "expanded"}`}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
      >
        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
        <div>
          <div className="day-num">
            Day {String(dayNumber).padStart(2, "0")}
            {isToday && <span className="day-today-badge">Today</span>}
          </div>
          <DayLocationLabel
            dayId={day.id}
            tripId={tripId}
            displayText={dayLocation || formatWeekday(day.date)}
            initialLabel={day.label}
            readOnly={readOnly}
          />
        </div>
        <span className="day-date">{formatDate(day.date)}</span>
        <span className="day-count">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="day-body" ref={bodyRef}>
        {allDayEvents.length > 0 && (
          <div className="day-all-day">
            {allDayEvents.map((event) => (
              <LodgingBanner key={event.id} event={event} tripId={tripId} readOnly={readOnly} destination={destination} days={days} />
            ))}
          </div>
        )}

        <DayNotes dayId={day.id} tripId={tripId} initialNotes={day.notes} readOnly={readOnly} />

        <SortableContext items={visibleEvents.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="timeline">
            {visibleEvents.length === 0 && (
              <p className="day-empty-note">
                {readOnly ? "No events planned for this day yet." : "No events yet — add your first one below."}
              </p>
            )}
            {visibleEvents.map((event) => (
              <SortableEvent
                key={event.id}
                event={event}
                dayNumber={dayNumber}
                tripId={tripId}
                readOnly={readOnly}
                timeFormat={timeFormat}
                currency={currency}
                destination={destination}
                overlapWith={overlaps.get(event.id)}
                days={days}
              />
            ))}
          </div>
        </SortableContext>

        {hiddenCount > 0 && (
          <button
            type="button"
            className="day-more-toggle"
            onClick={(e) => { e.stopPropagation(); setShowAllMobile(true); }}
          >
            Show {hiddenCount} more event{hiddenCount === 1 ? "" : "s"}
          </button>
        )}
        {isMobile && showAllMobile && displayedEvents.length > MOBILE_VISIBLE_LIMIT && (
          <button
            type="button"
            className="day-more-toggle"
            onClick={(e) => { e.stopPropagation(); setShowAllMobile(false); }}
          >
            Show less
          </button>
        )}

        {!readOnly && (
          <div className="add-event-row">
            <button className="add-event" onClick={(e) => { e.stopPropagation(); setAddOpen(true); }}>
              <span className="plus"><Icons.plus size={12} /></span>
              <span>Add event to Day {dayNumber}</span>
            </button>
            {canCopy && (
              <button
                type="button"
                className="day-copy-btn"
                onClick={(e) => { e.stopPropagation(); setCopyOpen(true); }}
              >
                <Icons.copy size={13} />
                Copy this day&rsquo;s events to&hellip;
              </button>
            )}
          </div>
        )}
      </div>

      <AddEventModal
        open={addOpen}
        dayId={day.id}
        tripId={tripId}
        dayLabel={`Day ${dayNumber} · ${formatDate(day.date)}`}
        dayDate={day.date}
        destination={destination}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />

      <Modal open={copyOpen} onClose={() => setCopyOpen(false)} ariaLabel="Copy events to another day">
        <div className="modal-head">
          <div className="left">
            <h3>Copy Day {String(dayNumber).padStart(2, "0")}&rsquo;s events</h3>
            <p>
              Adds {events.length} event{events.length === 1 ? "" : "s"} to the day you pick — the original stays put.
            </p>
          </div>
          <button className="icon-btn" onClick={() => setCopyOpen(false)} aria-label="Close">
            <Icons.close size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="copy-day-list">
            {copyTargets.map((d) => (
              <button
                key={d.id}
                type="button"
                className="copy-day-option"
                disabled={copying}
                onClick={() => handleCopyTo(d.id)}
              >
                <span className="cdo-num">Day {String(d.dayNumber).padStart(2, "0")}</span>
                <span className="cdo-label">{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </section>
  );
}
