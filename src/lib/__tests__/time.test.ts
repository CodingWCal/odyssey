import { describe, it, expect } from "vitest";
import { formatTime } from "@/lib/utils";

describe("formatTime (ODY-041)", () => {
  it.each([
    ["14:30", "2:30 PM"],
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["12:05", "12:05 PM"],
    ["23:59", "11:59 PM"],
    ["01:07", "1:07 AM"],
    ["9:05", "9:05 AM"],
  ])("12h: %s -> %s", (input, expected) => {
    expect(formatTime(input, "12h")).toBe(expected);
  });

  it.each([
    ["14:30", "14:30"],
    ["9:05", "09:05"],
    ["00:00", "00:00"],
    ["23:59", "23:59"],
  ])("24h: %s -> %s", (input, expected) => {
    expect(formatTime(input, "24h")).toBe(expected);
  });

  it("defaults to 12h", () => {
    expect(formatTime("14:30")).toBe("2:30 PM");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatTime("", "12h")).toBe("");
    expect(formatTime("noon", "12h")).toBe("noon");
    expect(formatTime("25:00", "12h")).toBe("25:00");
    expect(formatTime("12:75", "12h")).toBe("12:75");
  });
});
