"use client";

import { useState, useRef, useLayoutEffect, useMemo } from "react";
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
import { formatDate } from "@/lib/utils";

function SortableEvent({ event, tripId, readOnly }: { event: TripDay["events"][number]; tripId: string; readOnly?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id, disabled: readOnly });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <EventBlock
        event={event}
        tripId={tripId}
        isDragging={isDragging}
        readOnly={readOnly}
        dragHandle={
          readOnly ? undefined : (
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
}

export function DayBlock({ day, tripId, dayNumber, readOnly = false }: DayBlockProps) {
  const [events, setEvents] = useState(day.events);
  const [addOpen, setAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep local state in sync with server data after revalidation ("adjust
  // state during render" — replaces the old sync-in-effect + lint disable).
  const eventsSig = useMemo(() => JSON.stringify(day.events), [day.events]);
  const [prevSig, setPrevSig] = useState(eventsSig);
  if (eventsSig !== prevSig) {
    setPrevSig(eventsSig);
    setEvents(day.events);
  }

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
  }, [collapsed, events.length]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = events.findIndex((ev) => ev.id === active.id);
    const newIndex = events.findIndex((ev) => ev.id === over.id);
    const previous = events;
    const reordered = arrayMove(events, oldIndex, newIndex);
    setEvents(reordered);
    try {
      await reorderEvents(reordered.map((ev, i) => ({ id: ev.id, orderIndex: i })), tripId);
    } catch {
      setEvents(previous); // revert visibly on failure (ODY-013)
      toast("Reorder didn't stick — put back the way it was.");
    }
  }

  const weekday = new Date(day.date).toLocaleDateString("en-US", { weekday: "long" });

  return (
    <section className={`day-block${collapsed ? " collapsed" : ""}`}>
      <header className="day-head" onClick={() => setCollapsed((c) => !c)}>
        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
        <div>
          <div className="day-num">Day {String(dayNumber).padStart(2, "0")}</div>
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
          <SortableContext items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="timeline">
              {events.length === 0 && (
                <p style={{ color: "var(--ink-3)", fontStyle: "italic", fontSize: 13, padding: "12px 0" }}>
                  {readOnly ? "No events planned for this day yet." : "No events yet — add your first one below."}
                </p>
              )}
              {events.map((event) => (
                <SortableEvent key={event.id} event={event} tripId={tripId} readOnly={readOnly} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {!readOnly && (
          <div style={{ marginLeft: 38, marginTop: 8 }}>
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
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />
    </section>
  );
}
