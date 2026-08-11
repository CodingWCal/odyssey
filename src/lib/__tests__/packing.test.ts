import { describe, expect, it } from "vitest";
import { visiblePackingWhere } from "@/lib/packing";

describe("visiblePackingWhere (ODY-067)", () => {
  it("returns shared items and only the caller's personal items", () => {
    expect(visiblePackingWhere("trip-1", "me")).toEqual({ tripId: "trip-1", OR: [{ ownerId: null }, { ownerId: "me" }] });
  });
});
