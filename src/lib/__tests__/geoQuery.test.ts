import { describe, it, expect } from "vitest";
import { buildBiasedQuery } from "@/lib/geoQuery";

describe("buildBiasedQuery (ODY-091)", () => {
  it("returns the bare query when no destination is given", () => {
    expect(buildBiasedQuery("ramen")).toBe("ramen");
    expect(buildBiasedQuery("ramen", "")).toBe("ramen");
    expect(buildBiasedQuery("ramen", null)).toBe("ramen");
  });

  it("appends the destination to a bare place name", () => {
    expect(buildBiasedQuery("ramen", "Tokyo")).toBe("ramen, Tokyo");
  });

  it("trims whitespace on both inputs", () => {
    expect(buildBiasedQuery("  ramen  ", "  Tokyo ")).toBe("ramen, Tokyo");
  });

  it("leaves structured (comma) queries untouched", () => {
    expect(buildBiasedQuery("1-1 Chiyoda, Chiyoda City", "Tokyo")).toBe(
      "1-1 Chiyoda, Chiyoda City"
    );
  });

  it("does not duplicate a destination already present (case-insensitive)", () => {
    expect(buildBiasedQuery("ramen tokyo", "Tokyo")).toBe("ramen tokyo");
    expect(buildBiasedQuery("Ramen TOKYO", "tokyo")).toBe("Ramen TOKYO");
  });

  it("returns empty string for an empty query", () => {
    expect(buildBiasedQuery("   ", "Tokyo")).toBe("");
  });
});
