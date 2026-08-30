import { describe, it, expect } from "vitest";
import { splitDestinations, geocodeCandidates } from "@/lib/destinations";

describe("splitDestinations", () => {
  it("splits a two-city trip on 'and'", () => {
    expect(splitDestinations("Lisbon and Crete")).toEqual(["Lisbon", "Crete"]);
  });

  it("splits on &, /, +, and ;", () => {
    expect(splitDestinations("Tokyo & Kyoto")).toEqual(["Tokyo", "Kyoto"]);
    expect(splitDestinations("Rome / Florence")).toEqual(["Rome", "Florence"]);
    expect(splitDestinations("Oslo + Bergen")).toEqual(["Oslo", "Bergen"]);
    expect(splitDestinations("Lima; Cusco")).toEqual(["Lima", "Cusco"]);
  });

  it("keeps a country-qualified single destination intact", () => {
    expect(splitDestinations("Lisbon, Portugal")).toEqual(["Lisbon, Portugal"]);
  });

  it("returns a single-entry list when there's no separator", () => {
    expect(splitDestinations("Barcelona")).toEqual(["Barcelona"]);
  });

  it("trims whitespace and drops duplicates/empties", () => {
    expect(splitDestinations("  Paris  and  Paris ")).toEqual(["Paris"]);
    expect(splitDestinations("Nice and ")).toEqual(["Nice"]);
  });

  it("does not split ordinary words containing the letters 'and'", () => {
    expect(splitDestinations("Auckland")).toEqual(["Auckland"]);
    expect(splitDestinations("Santander")).toEqual(["Santander"]);
  });
});

describe("geocodeCandidates", () => {
  it("lists the full string first, then each segment", () => {
    expect(geocodeCandidates("Lisbon and Crete")).toEqual(["Lisbon and Crete", "Lisbon", "Crete"]);
  });

  it("also splits on commas as a fallback", () => {
    expect(geocodeCandidates("Lisbon, Crete")).toEqual(["Lisbon, Crete", "Lisbon", "Crete"]);
  });

  it("dedupes when a segment equals the whole string", () => {
    expect(geocodeCandidates("Barcelona")).toEqual(["Barcelona"]);
  });
});
