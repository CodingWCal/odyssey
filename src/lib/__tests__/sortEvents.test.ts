import { describe, it, expect } from "vitest";
import { sortEventsByTime } from "@/lib/sortEvents";

type Ev = { id: string; startTime: string | null; orderIndex: number };

function ev(id: string, startTime: string | null, orderIndex: number): Ev {
  return { id, startTime, orderIndex };
}

describe("sortEventsByTime (ODY-042)", () => {
  it("sorts by startTime ascending", () => {
    const input = [
      ev("c", "14:30", 0),
      ev("a", "09:00", 1),
      ev("b", "12:15", 2),
    ];
    expect(sortEventsByTime(input).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("puts events with no start time last, keeping orderIndex among themselves", () => {
    const input = [
      ev("untimed-late", null, 5),
      ev("timed", "10:00", 0),
      ev("untimed-early", "", 2),
      ev("untimed-mid", "  ", 3),
    ];
    expect(sortEventsByTime(input).map((e) => e.id)).toEqual([
      "timed",
      "untimed-early",
      "untimed-mid",
      "untimed-late",
    ]);
  });

  it("breaks equal startTime ties with orderIndex (stable)", () => {
    const input = [
      ev("second", "11:00", 2),
      ev("first", "11:00", 1),
      ev("third", "11:00", 3),
    ];
    expect(sortEventsByTime(input).map((e) => e.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("is 12h/24h-agnostic (compares stored HH:MM strings)", () => {
    const input = [
      ev("evening", "18:00", 0),
      ev("morning", "08:30", 1),
      ev("noon", "12:00", 2),
    ];
    expect(sortEventsByTime(input).map((e) => e.id)).toEqual([
      "morning",
      "noon",
      "evening",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [ev("b", "15:00", 0), ev("a", "09:00", 1)];
    const copy = [...input];
    sortEventsByTime(input);
    expect(input).toEqual(copy);
  });

  it("returns an empty array unchanged", () => {
    expect(sortEventsByTime([])).toEqual([]);
  });
});
