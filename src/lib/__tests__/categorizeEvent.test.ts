import { describe, it, expect } from "vitest";
import { categorizeEvent } from "@/lib/categorizeEvent";

describe("categorizeEvent (ODY-127)", () => {
  it("recognizes flights", () => {
    expect(categorizeEvent("Delta flight to LAX")).toBe("flight");
    expect(categorizeEvent("United Airlines to Tokyo")).toBe("flight");
    expect(categorizeEvent("Icelandair - Airways confirmation")).toBe("flight");
  });

  it("recognizes transport", () => {
    expect(categorizeEvent("Uber to the airport")).toBe("transport");
    expect(categorizeEvent("Lyft downtown")).toBe("transport");
    expect(categorizeEvent("Train to Kyoto")).toBe("transport");
    expect(categorizeEvent("Rental car pickup")).toBe("transport");
  });

  it("recognizes restaurants", () => {
    expect(categorizeEvent("Dinner at Nobu")).toBe("restaurant");
    expect(categorizeEvent("Brunch spot")).toBe("restaurant");
    expect(categorizeEvent("Café Central")).toBe("restaurant");
  });

  it("recognizes lodging", () => {
    expect(categorizeEvent("Marriott Hotel check-in")).toBe("hotel");
    expect(categorizeEvent("Airbnb in Lisbon")).toBe("hotel");
  });

  it("returns null when nothing matches, leaving the caller's type untouched", () => {
    expect(categorizeEvent("Walk around the old town")).toBeNull();
    expect(categorizeEvent("")).toBeNull();
  });
});
