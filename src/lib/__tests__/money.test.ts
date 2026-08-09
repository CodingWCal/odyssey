import { describe, it, expect } from "vitest";
import { formatMoney, TRIP_CURRENCY_CODES } from "@/lib/money";

describe("formatMoney (ODY-024)", () => {
  it("keeps cents when the amount has them", () => {
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(formatMoney(1234.56)).toBe("$1,234.56");
    // The exact bug from the audit: a $30.50 settle-up used to render "$31".
    expect(formatMoney(30.5)).toBe("$30.50");
  });

  it("stays clean on whole amounts (no trailing .00)", () => {
    expect(formatMoney(13)).toBe("$13");
    expect(formatMoney(1240)).toBe("$1,240");
    expect(formatMoney(0)).toBe("$0");
  });

  it("round-trips $1,234.56 intact (acceptance criterion)", () => {
    expect(formatMoney(1234.56)).toBe("$1,234.56");
  });

  it("respects the trip currency symbol", () => {
    expect(formatMoney(1234.56, "EUR")).toBe("€1,234.56");
    expect(formatMoney(1000, "GBP")).toBe("£1,000");
  });

  it("handles zero-decimal currencies naturally", () => {
    // JPY has no minor unit — a whole yen amount shouldn't sprout cents.
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
  });

  it("treats null/undefined/NaN as zero rather than blanking", () => {
    expect(formatMoney(null)).toBe("$0");
    expect(formatMoney(undefined)).toBe("$0");
    expect(formatMoney(Number.NaN)).toBe("$0");
  });

  it("falls back to USD formatting for an unknown currency code", () => {
    expect(formatMoney(50, "NOTACURRENCY")).toBe("$50");
  });

  it("exposes a non-empty list of selectable currency codes", () => {
    expect(TRIP_CURRENCY_CODES).toContain("USD");
    expect(TRIP_CURRENCY_CODES.length).toBeGreaterThan(1);
  });
});
