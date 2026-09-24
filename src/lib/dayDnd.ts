import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { TripEvent } from "@/types";

/**
 * Cross-day drag-and-drop for the itinerary (ODY-147). One DndContext spans
 * every day; each event card is a sortable carrying its day, and each whole
 * day (header + body) is a droppable so an empty or collapsed day is a target.
 */

/** Drag data on each sortable event card. */
export interface EventDragData {
  type: "event";
  dayId: string;
  dayNumber: number;
  event: TripEvent;
}

/** Drop data on each whole day. */
export interface DayDropData {
  type: "day";
  dayId: string;
  dayNumber: number;
}

type DragData = EventDragData | DayDropData;

export function dragDataOf(c: { data: { current?: unknown } } | null | undefined): DragData | undefined {
  return c?.data.current as DragData | undefined;
}

function isEventOfDay(c: DroppableContainer, dayId: string | undefined): boolean {
  const d = dragDataOf(c);
  return d?.type === "event" && d.dayId === dayId;
}

/**
 * Over another day → that whole day is the target (where it lands within the
 * day doesn't matter: the list is time-sorted). Over the event's own day, in
 * the gap between days, or with no pointer at all (keyboard) → the closest
 * event of its own day, exactly the per-day reorder it had before.
 */
export const itineraryCollision: CollisionDetection = (args) => {
  const activeDay = dragDataOf(args.active)?.dayId;
  if (args.pointerCoordinates) {
    const dayHits = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => dragDataOf(c)?.type === "day"),
    });
    const hit = dayHits[0];
    const hitDay = hit && dragDataOf(args.droppableContainers.find((c) => c.id === hit.id))?.dayId;
    if (hit && hitDay && hitDay !== activeDay) return [hit];
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => isEventOfDay(c, activeDay)),
  });
};

type DroppableContainersMap = Parameters<KeyboardCoordinateGetter>[1]["context"]["droppableContainers"];

/**
 * A view of dnd-kit's droppable registry whose enabled candidates are only
 * `dayId`'s events. Every other member (get, size, …) passes straight through
 * to the real map, so this only narrows what keyboard navigation can reach.
 */
export function scopeDroppablesToDay(all: DroppableContainersMap, dayId: string | undefined): DroppableContainersMap {
  return new Proxy(all, {
    get(target, prop) {
      if (prop === "getEnabled") return () => target.getEnabled().filter((c) => isEventOfDay(c, dayId));
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * Keyboard reordering stays within the event's own day, as it did when each
 * day had its own DndContext — keyboard users move events between days with
 * the Day picker in the edit form instead.
 */
export const sameDayKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const dayId = dragDataOf(args.context.active)?.dayId;
  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableContainers: scopeDroppablesToDay(args.context.droppableContainers, dayId) },
  });
};

/**
 * Optimistically place an event dragged in from another day at the end of
 * this day's list, as the server does (after the last orderIndex). The list
 * is time-sorted on render, so a timed event still lands in time order.
 */
export function applyIncomingEvent(events: TripEvent[], moved: TripEvent, dayId: string, dayDate: Date): TripEvent[] {
  if (events.some((e) => e.id === moved.id)) return events;
  const orderIndex = events.reduce((max, e) => Math.max(max, e.orderIndex), -1) + 1;
  return [...events, { ...moved, dayId, dayDate, orderIndex }];
}
