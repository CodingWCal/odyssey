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
import type { TripDay } from "@/types";
import { formatDate } from "@/lib/utils";

function SortableEvent({ event, tripId }: { event: TripDay["events"][number]; tripId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <EventBlock
        event={event}
        tripId={tripId}
        isDragging={isDragging}
        dragHandle={
          <span {...listeners} className="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">
            <Icons.drag size={14} />
          </span>
        }
      />
    </div>
  );
}

interface DayBlockProps {
  day: TripDay;
  tripId: string;
  dayNumber: number;
}

export function DayBlock({ day, tripId, dayNumber }: DayBlockProps) {
  const [events, setEvents] = useState(day.events);
  const [addOpen, setAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<string>("3000px");

  // Keep local state in sync with server data after revalidation.
  const eventsSig = useMemo(() => JSON.stringify(day.events), [day.events]);
  useEffect(() => {
    setEvents(day.events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsSig]);

  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    if (collapsed) {
      setMaxH("0px");
    } else {
      setMaxH(bodyRef.current.scrollHeight + "px");
      const t = setTimeout(() => setMaxH("3000px"), 360);
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
    const reordered = arrayMove(events, oldIndex, newIndex);
    setEvents(reordered);
    await reorderEvents(reordered.map((ev, i) => ({ id: ev.id, orderIndex: i })), tripId);
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

      <div className="day-body" ref={bodyRef} style={{ maxHeight: maxH }}>
        <DayNotes dayId={day.id} tripId={tripId} initialNotes={day.notes} />

        <DndContext id={`dnd-day-${day.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="timeline">
              {events.length === 0 && (
                <p style={{ color: "var(--ink-3)", fontStyle: "italic", fontSize: 13, padding: "12px 0" }}>
                  No events yet — add your first one below.
                </p>
              )}
              {events.map((event) => (
                <SortableEvent key={event.id} event={event} tripId={tripId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div style={{ marginLeft: 38, marginTop: 8 }}>
          <button className="add-event" onClick={(e) => { e.stopPropagation(); setAddOpen(true); }}>
            <span className="plus"><Icons.plus size={12} /></span>
            <span>Add event to Day {dayNumber}</span>
          </button>
        </div>
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
