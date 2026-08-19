import { describe, it, expect } from "vitest";
import { buildTripIcs, icsFilename, type IcsEvent } from "@/lib/icsExport";

// A fixed "now" so DTSTAMP is deterministic.
const NOW = new Date(Date.UTC(2026, 7, 19, 12, 30, 0)); // 2026-08-19T12:30:00Z

// Day rows are stored UTC-midnight (ODY-003).
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

function ev(partial: Partial<IcsEvent>): IcsEvent {
  return {
    id: "e1",
    title: "Event",
    date: day(2026, 7, 10),
    ...partial,
  };
}

describe("buildTripIcs (ODY-069)", () => {
  it("wraps events in a VCALENDAR with required headers", () => {
    const ics = buildTripIcs({ title: "Lisbon", events: [] }, NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Odyssey//Trip Itinerary//EN");
    expect(ics).toContain("X-WR-CALNAME:Lisbon");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("uses CRLF line endings and a trailing CRLF", () => {
    const ics = buildTripIcs({ title: "T", events: [] }, NOW);
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.endsWith("\r\n")).toBe(true);
    // No bare LFs.
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("emits a timed event as floating local time (no Z, no TZID)", () => {
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: "09:00", endTime: "10:30" })] },
      NOW
    );
    expect(ics).toContain("DTSTART:20260710T090000");
    expect(ics).toContain("DTEND:20260710T103000");
    expect(ics).not.toContain("DTSTART;TZID");
    expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/); // no UTC marker on local times
  });

  it("defaults a timed event with no end to a 60-minute block", () => {
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: "14:00" })] },
      NOW
    );
    expect(ics).toContain("DTSTART:20260710T140000");
    expect(ics).toContain("DTEND:20260710T150000");
  });

  it("clamps a late default block to the same calendar day", () => {
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: "23:30" })] },
      NOW
    );
    expect(ics).toContain("DTSTART:20260710T233000");
    expect(ics).toContain("DTEND:20260710T235900");
  });

  it("falls back to a 60-minute block when end is before start", () => {
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: "10:00", endTime: "09:00" })] },
      NOW
    );
    expect(ics).toContain("DTEND:20260710T110000");
  });

  it("emits an untimed event as an all-day span (exclusive next-day DTEND)", () => {
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: null, date: day(2026, 7, 31) })] },
      NOW
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20260731");
    expect(ics).toContain("DTEND;VALUE=DATE:20260801");
  });

  it("uses UTC calendar components so dates don't drift", () => {
    // Dec 31 UTC-midnight must export as 20261231, never 20261230.
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: "08:00", date: day(2026, 12, 31) })] },
      NOW
    );
    expect(ics).toContain("DTSTART:20261231T080000");
  });

  it("includes a stable per-event UID and the fixed DTSTAMP", () => {
    const ics = buildTripIcs(
      { title: "T", events: [ev({ id: "abc-123", startTime: "08:00" })] },
      NOW
    );
    expect(ics).toContain("UID:abc-123@odyssey");
    expect(ics).toContain("DTSTAMP:20260819T123000Z");
  });

  it("falls back to the trip destination when an event has no location", () => {
    const ics = buildTripIcs(
      { title: "T", destination: "Porto", events: [ev({ startTime: "08:00" })] },
      NOW
    );
    expect(ics).toContain("LOCATION:Porto");
  });

  it("prefers the event's own location over the destination", () => {
    const ics = buildTripIcs(
      {
        title: "T",
        destination: "Porto",
        events: [ev({ startTime: "08:00", location: "Livraria Lello" })],
      },
      NOW
    );
    expect(ics).toContain("LOCATION:Livraria Lello");
    expect(ics).not.toContain("LOCATION:Porto");
  });

  it("escapes commas, semicolons, backslashes, and newlines in text", () => {
    const ics = buildTripIcs(
      {
        title: "T",
        events: [ev({ startTime: "08:00", title: "Dinner; drinks, maybe", notes: "line1\nline2" })],
      },
      NOW
    );
    expect(ics).toContain("SUMMARY:Dinner\\; drinks\\, maybe");
    expect(ics).toContain("DESCRIPTION:line1\\nline2");
  });

  it("omits LOCATION and DESCRIPTION when absent", () => {
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: "08:00" })] },
      NOW
    );
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("folds long content lines at 75 octets with CRLF + space", () => {
    const long = "A".repeat(200);
    const ics = buildTripIcs(
      { title: "T", events: [ev({ startTime: "08:00", notes: long })] },
      NOW
    );
    // Every physical line stays within the 75-octet limit.
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // Continuation lines begin with a single space.
    expect(ics).toMatch(/\r\n /);
  });
});

describe("icsFilename", () => {
  it("slugifies the trip title", () => {
    expect(icsFilename("Lisbon in May!")).toBe("odyssey-lisbon-in-may.ics");
  });
  it("falls back to 'trip' for an empty slug", () => {
    expect(icsFilename("   ")).toBe("odyssey-trip.ics");
  });
});
