import { describe, it, expect } from "vitest";
import { getConditionFromCode } from "@/lib/weather";

describe("getConditionFromCode (WMO codes)", () => {
  it.each([
    [0, "clear"],
    [1, "cloudy"],
    [3, "cloudy"],
    [45, "fog"],
    [48, "fog"],
    [51, "rain"],
    [67, "rain"],
    [71, "snow"],
    [77, "snow"],
    [80, "rain"],
    [82, "rain"],
    [95, "storm"],
    [99, "storm"],
    [100, "default"],
  ])("maps code %i to %s", (code, expected) => {
    expect(getConditionFromCode(code)).toBe(expected);
  });
});
