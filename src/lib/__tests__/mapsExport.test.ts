import { describe, it, expect } from "vitest";
import { googleMapsUrl } from "@/lib/mapsExport";

describe("googleMapsUrl (ODY-072)", () => {
  it("returns null when nothing is located", () => {
    expect(googleMapsUrl([])).toBeNull();
    expect(googleMapsUrl([{ lat: null, lng: null }, { lat: 1, lng: undefined }])).toBeNull();
  });

  it("a single stop opens a search pin", () => {
    expect(googleMapsUrl([{ lat: 35.66, lng: 139.7 }])).toBe(
      "https://www.google.com/maps/search/?api=1&query=35.66%2C139.7"
    );
  });

  it("two or more stops open directions in order", () => {
    const url = googleMapsUrl([
      { lat: 35.6, lng: 139.7 },
      { lat: 35.7, lng: 139.8 },
      { lat: 35.5, lng: 139.6 },
    ]);
    expect(url).toBe("https://www.google.com/maps/dir/35.6,139.7/35.7,139.8/35.5,139.6");
  });

  it("skips unlocated stops but keeps the order of the rest", () => {
    const url = googleMapsUrl([
      { lat: 1, lng: 1 },
      { lat: null, lng: 2 },
      { lat: 3, lng: 3 },
    ]);
    expect(url).toBe("https://www.google.com/maps/dir/1,1/3,3");
  });

  it("rejects non-finite coordinates", () => {
    expect(googleMapsUrl([{ lat: Number.NaN, lng: 5 }])).toBeNull();
  });
});
