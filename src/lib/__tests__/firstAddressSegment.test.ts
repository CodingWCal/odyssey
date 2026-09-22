import { describe, it, expect } from "vitest";
import { firstAddressSegment } from "@/lib/utils";

describe("firstAddressSegment (ODY-129)", () => {
  it("returns the text before the first comma", () => {
    expect(firstAddressSegment("123 Main St, Cambridge, MA 02139, United States")).toBe("123 Main St");
  });

  it("trims surrounding whitespace", () => {
    expect(firstAddressSegment("  Eiffel Tower  , Paris, France")).toBe("Eiffel Tower");
  });

  it("returns the input unchanged when there's no comma", () => {
    expect(firstAddressSegment("Lisbon")).toBe("Lisbon");
  });

  it("handles an empty string", () => {
    expect(firstAddressSegment("")).toBe("");
  });
});
