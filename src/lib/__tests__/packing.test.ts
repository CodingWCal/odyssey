import { describe, expect, it } from "vitest";
import { groupPackingItemsByEvent, visiblePackingWhere } from "@/lib/packing";

describe("visiblePackingWhere (ODY-067)", () => {
  it("returns shared items and only the caller's personal items", () => {
    expect(visiblePackingWhere("trip-1", "me")).toEqual({ tripId: "trip-1", OR: [{ ownerId: null }, { ownerId: "me" }] });
  });
});

describe("groupPackingItemsByEvent (ODY-067 Stage B)", () => {
  it("groups items by eventId, preserving order within each group", () => {
    const items = [
      { id: "1", eventId: "ev-a", label: "Boots", done: false },
      { id: "2", eventId: "ev-b", label: "Passport", done: true },
      { id: "3", eventId: "ev-a", label: "Rain shell", done: false },
    ];
    const grouped = groupPackingItemsByEvent(items);
    expect(grouped.get("ev-a")).toEqual([
      { id: "1", label: "Boots", done: false },
      { id: "3", label: "Rain shell", done: false },
    ]);
    expect(grouped.get("ev-b")).toEqual([{ id: "2", label: "Passport", done: true }]);
  });

  it("drops trip-level (eventId: null) items", () => {
    const items = [{ id: "1", eventId: null, label: "Sunscreen", done: false }];
    expect(groupPackingItemsByEvent(items).size).toBe(0);
  });

  it("returns an empty map for no items", () => {
    expect(groupPackingItemsByEvent([]).size).toBe(0);
  });
});
