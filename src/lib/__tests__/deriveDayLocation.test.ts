import { describe, it, expect } from "vitest";
import { deriveDayLocation } from "@/lib/deriveDayLocation";

describe("deriveDayLocation (ODY-124)", () => {
  it("shows the trip destination as-is for a single-destination trip", () => {
    const day = { events: [{ location: "Eiffel Tower, Paris, France" }] };
    expect(deriveDayLocation(day, "Lisbon, Portugal")).toBe("Lisbon, Portugal");
  });

  it("picks the matching city for a multi-destination trip", () => {
    const kyotoDay = { events: [{ location: "Fushimi Inari, Kyoto, Japan" }] };
    expect(deriveDayLocation(kyotoDay, "Tokyo & Kyoto, Japan")).toBe("Kyoto");

    const tokyoDay = { events: [{ location: "Shibuya Crossing, Tokyo, Japan" }] };
    expect(deriveDayLocation(tokyoDay, "Tokyo & Kyoto, Japan")).toBe("Tokyo");
  });

  it("falls back to the full trip destination when no event location matches a candidate city", () => {
    const day = { events: [{ location: null }, { location: "" }] };
    expect(deriveDayLocation(day, "Tokyo & Kyoto, Japan")).toBe("Tokyo & Kyoto, Japan");
  });

  it("falls back cleanly when the trip has no destination set", () => {
    expect(deriveDayLocation({ events: [] }, undefined)).toBe("");
    expect(deriveDayLocation({ events: [] }, null)).toBe("");
  });

  it("uses the first event with a matching city, ignoring events without one", () => {
    const day = {
      events: [{ location: "Some venue, Unknown City" }, { location: "A spot, Kyoto, Japan" }],
    };
    expect(deriveDayLocation(day, "Tokyo & Kyoto, Japan")).toBe("Kyoto");
  });
});
