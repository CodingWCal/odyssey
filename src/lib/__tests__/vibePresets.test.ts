import { describe, it, expect } from "vitest";
import { resolveVibe, buildOverpassQuery, DEFAULT_PRESET } from "@/lib/vibePresets";

describe("resolveVibe (ODY-049)", () => {
  it("maps the preset vibe chips to their OSM categories", () => {
    expect(resolveVibe("cozy cafés").filters).toEqual(['["amenity"="cafe"]']);
    expect(resolveVibe("local eats").category).toBe("restaurant");
    expect(resolveVibe("sunset views").filters).toEqual(['["tourism"="viewpoint"]']);
    expect(resolveVibe("museums").filters).toContain('["tourism"="museum"]');
    expect(resolveVibe("parks & walks").filters).toContain('["leisure"="park"]');
    expect(resolveVibe("nightlife").filters).toEqual(['["amenity"~"^(bar|pub|nightclub)$"]']);
  });

  it("carries a non-empty Foursquare query for every resolved preset", () => {
    for (const vibe of ["cozy cafés", "local eats", "sunset views", "museums", "nightlife", "something whimsical"]) {
      expect(resolveVibe(vibe).fsqQuery.length).toBeGreaterThan(0);
    }
    expect(resolveVibe("cozy cafés").fsqQuery).toBe("coffee");
    expect(DEFAULT_PRESET.fsqQuery).toBe("tourist attraction");
  });

  it("is case-insensitive and matches on substrings of free text", () => {
    expect(resolveVibe("Somewhere for great COFFEE").filters).toEqual(['["amenity"="cafe"]']);
    expect(resolveVibe("a scenic lookout at dusk").filters).toEqual(['["tourism"="viewpoint"]']);
  });

  it("falls back to general attractions for an unrecognised vibe", () => {
    expect(resolveVibe("something whimsical")).toBe(DEFAULT_PRESET);
    expect(resolveVibe("")).toBe(DEFAULT_PRESET);
  });
});

describe("buildOverpassQuery (ODY-049)", () => {
  it("emits node/way/relation clauses for each filter, name-gated and bounded", () => {
    const q = buildOverpassQuery(['["amenity"="cafe"]'], 35.68, 139.76, 9000, 40);
    expect(q).toContain("[out:json]");
    expect(q).toContain('node["amenity"="cafe"]["name"](around:9000,35.68,139.76);');
    expect(q).toContain('way["amenity"="cafe"]["name"](around:9000,35.68,139.76);');
    expect(q).toContain('relation["amenity"="cafe"]["name"](around:9000,35.68,139.76);');
    expect(q.trimEnd().endsWith("out center 40;")).toBe(true);
  });

  it("unions multiple filters in one query", () => {
    const q = buildOverpassQuery(['["leisure"="park"]', '["leisure"="garden"]'], 0, 0, 5000, 10);
    expect(q).toContain('["leisure"="park"]');
    expect(q).toContain('["leisure"="garden"]');
  });
});
