"use client";

import { useState, useRef, useLayoutEffect } from "react";
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
import { reorderEvents } from "@/app/trips/[tripId]/itinerary/actions";
import type { TripDay } from "@/types";
import { formatDate } from "@/lib/utils";

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="5" r="1.5" />
      <circle cx="16" cy="5" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
      <circle cx="16" cy="12" r="1.5" />
      <circle cx="8" cy="19" r="1.5" />
      <circle cx="16" cy="19" r="1.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="day-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SortableEvent({ event, tripId }: { event: TripDay["events"][number]; tripId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <EventBlock
        event={event}
        tripId={tripId}
        isDragging={isDragging}
        dragHandle={
          <span
            {...listeners}
            className="drag-handle"
            aria-label="Drag to reorder"
          >
            <GripIcon />
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

  // Animate collapse
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = events.findIndex((e) => e.id === active.id);
    const newIndex = events.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(events, oldIndex, newIndex);

    setEvents(reordered);
    await reorderEvents(
      reordered.map((e, i) => ({ id: e.id, orderIndex: i })),
      tripId
    );
  }

  return (
    <section className={`day-block${collapsed ? " od-collapsed" : ""}`}>
      {/* Day header */}
      <header className="day-head" onClick={() => setCollapsed((c) => !c)}>
        <ChevronIcon />
        <div>
          <div className="day-num">Day {String(dayNumber).padStart(2, "0")}</div>
          <h2 className="day-title" style={{ margin: 0 }}>
            {formatDate(day.date)}
          </h2>
        </div>
        <span className="day-date" style={{ marginLeft: 8 }}>
          {new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}
        </span>
        <span className="day-count">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </header>

      {/* Collapsible body */}
      <div
        className="day-body"
        ref={bodyRef}
        style={{ maxHeight: maxH }}
      >
        <DndContext
          id={`dnd-day-${day.id}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
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

        {/* Add event */}
        <div style={{ marginLeft: 38, marginTop: 8 }}>
          <button
            className="add-event-btn"
            onClick={(e) => { e.stopPropagation(); setAddOpen(true); }}
          >
            <span className="plus">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            Add event to Day {dayNumber}
          </button>
        </div>
      </div>

      {/* Add event modal */}
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
