"use client";

import { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EventBlock } from "./EventBlock";
import { AddEventModal } from "./AddEventModal";
import { DayNotes } from "./DayNotes";
import { reorderEvents } from "@/app/trips/[tripId]/itinerary/actions";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";
import type { TripDay } from "@/types";
import { formatDate, type TimeFormat } from "@/lib/utils";
import { formatWeekday, localDateKey, toDateInputValue } from "@/lib/dates";
import { sortEventsByTime } from "@/lib/sortEvents";
import { findOverlaps } from "@/lib/eventOverlap";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

const MOBILE_VISIBLE_LIMIT = 5;

function SortableEvent({
  event,
  tripId,
  readOnly,
  timeFormat,
  destination,
  overlapWith,
}: {
  event: TripDay["events"][number];
  tripId: string;
  readOnly?: boolean;
  timeFormat?: TimeFormat;
  destination?: string;
  overlapWith?: string[];
}) {
  const disabled = Boolean(readOnly);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
    disabled,
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
        destination={destination}
        overlapWith={overlapWith}
        dragHandle={
          disabled ? undefined : (
            <span {...listeners} className="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">
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
  /** Trip destination — biases location search toward it (ODY-091). */
  destination?: string;
}

export function DayBlock({ day, tripId, dayNumber, readOnly = false, timeFormat = "12h", destination }: DayBlockProps) {
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
      el.style.maxHeight = "0px";
    } else {
      el.style.maxHeight = el.scrollHeight + "px";
      const t = setTimeout(() => {
        el.style.maxHeight = "3000px";
      }, 360);
      return () => clearTimeout(t);
    }
  }, [collapsed, events.length, visibleEvents.length]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(e: DragEndEvent) {
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

  const weekday = formatWeekday(day.date);

  return (
    <section ref={sectionRef} className={`day-block${collapsed ? " collapsed" : ""}${isToday ? " is-today" : ""}`}>
      <header className="day-head" onClick={() => setCollapsed((c) => !c)}>
        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
        <div>
          <div className="day-num">
            Day {String(dayNumber).padStart(2, "0")}
            {isToday && <span className="day-today-badge">Today</span>}
          </div>
          <h2 className="day-title">{weekday}</h2>
        </div>
        <span className="day-date">{formatDate(day.date)}</span>
        <span className="day-count">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="day-body" ref={bodyRef}>
        <DayNotes dayId={day.id} tripId={tripId} initialNotes={day.notes} readOnly={readOnly} />

        <DndContext id={`dnd-day-${day.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                  tripId={tripId}
                  readOnly={readOnly}
                  timeFormat={timeFormat}
                  destination={destination}
                  overlapWith={overlaps.get(event.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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
          </div>
        )}
      </div>

      <AddEventModal
        open={addOpen}
        dayId={day.id}
        tripId={tripId}
        dayLabel={`Day ${dayNumber} · ${formatDate(day.date)}`}
        destination={destination}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />
    </section>
  );
}
