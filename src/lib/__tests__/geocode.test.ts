import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { searchPlaces, GeocodeRateLimitError } from "@/lib/geocode";

function nominatimHit(display: string) {
  return { display_name: display, lat: "1.23", lon: "4.56" };
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchPlaces destination-bias fallback (ODY-106)", () => {
  it("falls back to the unbiased query when the biased query returns zero results", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        // The biased request (query + ", Boston, Massachusetts") finds
        // nothing — mirrors Gillette Stadium not being IN Boston.
        if (url.includes("Boston")) return jsonResponse([]);
        return jsonResponse([nominatimHit("Gillette Stadium, Foxborough, Massachusetts")]);
      })
    );

    const results = await searchPlaces("Gillette Stadium fb1", 5, { near: "Boston, Massachusetts" });

    expect(urls).toHaveLength(2); // biased attempt, then unbiased fallback
    expect(urls[0]).toContain("Boston");
    expect(urls[1]).not.toContain("Boston");
    expect(results).toEqual([{ display: "Gillette Stadium, Foxborough, Massachusetts", lat: 1.23, lng: 4.56 }]);
  });

  it("does not fall back when the biased query already returns results", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([nominatimHit("Starbucks, Newark, New Jersey")]));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchPlaces("Starbucks fb2", 5, { near: "Newark, New Jersey" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
  });

  it("does not make a second request when there was no bias to begin with", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchPlaces("nowhere at all fb3");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([]);
  });

  it("does not fall back for a structured (comma-containing) query — biasing already skipped it", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchPlaces("221B Baker Street, London fb4", 5, { near: "London, UK" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([]);
  });
});

describe("searchPlaces rate limiting with fallback (ODY-106)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
  });

  it("propagates GeocodeRateLimitError if the fallback call would exceed quota", async () => {
    const userKey = `rl-test-${Date.now()}-${Math.random()}`;
    // Exhaust the window with 30 cheap, distinct (uncached) queries so the
    // biased attempt below is itself over quota... instead, more directly:
    // drive the count to exactly the limit, then let the biased fetch (miss,
    // returns []) consume the last unit, forcing the fallback fetch to throw.
    for (let i = 0; i < 29; i++) {
      await searchPlaces(`filler query ${i} rl`, 5, { userKey });
    }
    await expect(
      searchPlaces("Gillette Stadium rl-final", 5, { userKey, near: "Boston, Massachusetts" })
    ).rejects.toThrow(GeocodeRateLimitError);
  });
});
