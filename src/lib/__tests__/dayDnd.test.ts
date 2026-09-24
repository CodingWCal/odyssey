import { describe, it, expect } from "vitest";
import type { Active, ClientRect, DroppableContainer } from "@dnd-kit/core";
import { itineraryCollision, applyIncomingEvent, scopeDroppablesToDay } from "@/lib/dayDnd";
import type { TripEvent } from "@/types";

function rect(top: number, height: number): ClientRect {
  return { top, left: 0, width: 300, height, bottom: top + height, right: 300 };
}

function container(id: string, data: object, disabled = false): DroppableContainer {
  return {
    id,
    key: id,
    data: { current: data },
    disabled,
    node: { current: null },
    rect: { current: null },
  } as unknown as DroppableContainer;
}

// Day 1 (0–400) holds e1 and e2; Day 2 (450–850) holds e3; Day 3 (900–1000) is empty.
const containers = [
  container("day:d1", { type: "day", dayId: "d1", dayNumber: 1 }),
  container("e1", { type: "event", dayId: "d1", dayNumber: 1 }),
  container("e2", { type: "event", dayId: "d1", dayNumber: 1 }),
  container("day:d2", { type: "day", dayId: "d2", dayNumber: 2 }),
  container("e3", { type: "event", dayId: "d2", dayNumber: 2 }),
  container("day:d3", { type: "day", dayId: "d3", dayNumber: 3 }),
];
const rects = new Map<string, ClientRect>([
  ["day:d1", rect(0, 400)],
  ["e1", rect(40, 80)],
  ["e2", rect(140, 80)],
  ["day:d2", rect(450, 400)],
  ["e3", rect(490, 80)],
  ["day:d3", rect(900, 100)],
]);
const active = { id: "e1", data: { current: { type: "event", dayId: "d1", dayNumber: 1 } } } as unknown as Active;

function collide(pointerY: number | null, collisionTop: number) {
  return itineraryCollision({
    active,
    collisionRect: rect(collisionTop, 80),
    droppableRects: rects,
    droppableContainers: containers,
    pointerCoordinates: pointerY == null ? null : { x: 150, y: pointerY },
  });
}

describe("itineraryCollision", () => {
  it("targets another day as a whole when the pointer is over one of its events", () => {
    expect(collide(530, 490).map((c) => c.id)).toEqual(["day:d2"]);
  });

  it("targets an empty day", () => {
    expect(collide(950, 910).map((c) => c.id)).toEqual(["day:d3"]);
  });

  it("reorders within the event's own day exactly like before (closest same-day event)", () => {
    expect(collide(180, 140)[0].id).toBe("e2");
  });

  it("never lands on another day when the pointer is in the gap between days", () => {
    const ids = collide(425, 390).map((c) => c.id);
    expect(ids.every((id) => id === "e1" || id === "e2")).toBe(true);
  });

  it("keeps keyboard drags (no pointer) inside the event's own day", () => {
    // The keyboard-moved rect sits over Day 2's event, but with no pointer the
    // only candidates are Day 1's events — cross-day moves use the Day picker.
    const ids = collide(null, 490).map((c) => c.id);
    expect(ids.every((id) => id === "e1" || id === "e2")).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe("scopeDroppablesToDay", () => {
  class FakeMap extends Map<string, DroppableContainer> {
    getEnabled() {
      return [...this.values()].filter((c) => !c.disabled);
    }
  }
  const all = new FakeMap(containers.map((c) => [String(c.id), c]));
  all.set("e4", container("e4", { type: "event", dayId: "d1", dayNumber: 1 }, true));
  const scoped = scopeDroppablesToDay(all as never, "d1") as unknown as FakeMap;

  it("limits the enabled candidates to that day's enabled events", () => {
    expect(scoped.getEnabled().map((c) => c.id)).toEqual(["e1", "e2"]);
  });

  it("still resolves any container by id and passes other members through", () => {
    expect(scoped.get("e3")?.id).toBe("e3");
    expect(scoped.size).toBe(all.size);
  });
});

describe("applyIncomingEvent", () => {
  const ev = (id: string, orderIndex: number, dayId = "d2") =>
    ({ id, orderIndex, dayId, title: id }) as unknown as TripEvent;
  const target = new Date("2026-10-03T00:00:00Z");

  it("appends the moved event after the day's last orderIndex, re-homed to this day", () => {
    const out = applyIncomingEvent([ev("a", 0), ev("b", 4)], ev("m", 1, "d1"), "d2", target);
    expect(out.map((e) => e.id)).toEqual(["a", "b", "m"]);
    expect(out[2]).toMatchObject({ dayId: "d2", orderIndex: 5, dayDate: target });
  });

  it("starts at orderIndex 0 on an empty day", () => {
    expect(applyIncomingEvent([], ev("m", 3, "d1"), "d2", target)[0].orderIndex).toBe(0);
  });

  it("is a no-op if the event is already in this day (e.g. server props arrived first)", () => {
    const events = [ev("m", 0)];
    expect(applyIncomingEvent(events, ev("m", 9, "d1"), "d2", target)).toBe(events);
  });
});
