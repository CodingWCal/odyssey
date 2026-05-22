"use client";

import { useState } from "react";
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
import { EventForm } from "./EventForm";
import { reorderEvents } from "@/app/trips/[tripId]/itinerary/actions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/types";
import { formatDate } from "@/lib/utils";

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

function SortableEvent({ event, tripId }: { event: TripDay["events"][number]; tripId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <EventBlock
        event={event}
        tripId={tripId}
        dragHandle={<span {...listeners} aria-label="Drag to reorder"><GripIcon /></span>}
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
    <div className="mb-8">
      <div className="sticky top-0 z-10 bg-odyssey-mist/95 backdrop-blur-sm py-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-odyssey-periwinkle" aria-hidden="true" />
          <div>
            <h3 className="font-heading text-odyssey-ink text-lg">
              Day {dayNumber}
            </h3>
            <p className="text-xs text-odyssey-slate">{formatDate(day.date)}</p>
          </div>
        </div>
      </div>

      <DndContext id={`dnd-day-${day.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 pl-4">
            {events.length === 0 && (
              <p className="text-sm text-odyssey-slate/60 italic py-2">No events yet — add your first one.</p>
            )}
            {events.map((event) => (
              <SortableEvent key={event.id} event={event} tripId={tripId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="pl-4 mt-3">
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger render={<Button variant="ghost" size="sm" className="text-odyssey-teal hover:text-odyssey-teal hover:bg-odyssey-teal/10 rounded-xl text-xs" />}>
            + Add Event
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="font-heading">Add Event — {formatDate(day.date)}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <EventForm
                tripId={tripId}
                dayId={day.id}
                onSuccess={() => setAddOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
