"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { TYPE_VAR } from "./EventBlock";
import { formatTime, type TimeFormat } from "@/lib/utils";
import { itineraryCollision, sameDayKeyboardCoordinates, dragDataOf } from "@/lib/dayDnd";
import type { TripEvent } from "@/types";

interface BoardContextValue {
  /** Bumped when a cross-day move fails, so every day drops its optimistic
   * state and re-reads the server's copy. */
  resyncToken: number;
  resync: () => void;
}

const BoardContext = createContext<BoardContextValue>({ resyncToken: 0, resync: () => {} });

export function useItineraryBoard() {
  return useContext(BoardContext);
}

/**
 * One drag-and-drop surface spanning every day of the itinerary (ODY-147), so
 * an event can be dragged onto a different day. Each DayBlock handles its own
 * side of a drop (see its useDndMonitor); this only owns the shared context
 * and the floating drag preview.
 */
export function ItineraryBoard({ timeFormat, children }: { timeFormat: TimeFormat; children: React.ReactNode }) {
  const [resyncToken, setResyncToken] = useState(0);
  const [dragging, setDragging] = useState<TripEvent | null>(null);
  const [targetDayNumber, setTargetDayNumber] = useState<number | null>(null);
  const resync = useCallback(() => setResyncToken((t) => t + 1), []);
  const board = useMemo(() => ({ resyncToken, resync }), [resyncToken, resync]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sameDayKeyboardCoordinates })
  );

  function onDragStart(e: DragStartEvent) {
    const data = dragDataOf(e.active);
    setDragging(data?.type === "event" ? data.event : null);
  }

  function onDragOver(e: DragOverEvent) {
    const over = dragDataOf(e.over);
    const from = dragDataOf(e.active)?.dayId;
    setTargetDayNumber(over && over.dayId !== from ? over.dayNumber : null);
  }

  function clear() {
    setDragging(null);
    setTargetDayNumber(null);
  }

  return (
    <BoardContext.Provider value={board}>
      <DndContext
        id="itinerary-dnd"
        sensors={sensors}
        collisionDetection={itineraryCollision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={clear}
        onDragCancel={clear}
      >
        {children}
        {/* A day's body clips overflow (for its collapse animation), so the
            card itself can't be seen leaving its own day — the lifted copy
            follows the pointer in this fixed-position overlay instead. No drop
            animation: on a cross-day drop the source card is already gone. */}
        <DragOverlay dropAnimation={null}>
          {dragging && <DragPreview event={dragging} timeFormat={timeFormat} targetDayNumber={targetDayNumber} />}
        </DragOverlay>
      </DndContext>
    </BoardContext.Provider>
  );
}

function DragPreview({
  event,
  timeFormat,
  targetDayNumber,
}: {
  event: TripEvent;
  timeFormat: TimeFormat;
  targetDayNumber: number | null;
}) {
  return (
    <div className="drag-preview" style={{ "--type-color": `var(--${TYPE_VAR[event.type] ?? "slate"})` } as React.CSSProperties}>
      <div className={`event-card t-${event.type}`}>
        <div className="event-top">
          <div className="event-time">
            <span>{event.startTime ? formatTime(event.startTime, timeFormat) : "—"}</span>
          </div>
          <div className="event-main">
            <div className="event-headline">
              <TypeBadge type={event.type} />
              <h4 className="event-title">{event.title}</h4>
            </div>
          </div>
        </div>
      </div>
      {targetDayNumber != null && (
        <span className="drag-preview-target">Move to Day {String(targetDayNumber).padStart(2, "0")}</span>
      )}
    </div>
  );
}
