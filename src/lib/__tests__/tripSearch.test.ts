import { describe, it, expect } from "vitest";
import { isSearchable, snippetAround, searchNoteSections, MIN_QUERY_LENGTH } from "@/lib/tripSearch";

describe("isSearchable (ODY-083)", () => {
  it("requires at least the minimum length, ignoring whitespace", () => {
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable("  r ")).toBe(false);
    expect(isSearchable("ra")).toBe(true);
    expect(MIN_QUERY_LENGTH).toBe(2);
  });
});

describe("snippetAround (ODY-083)", () => {
  it("centers on the match with ellipses when trimmed", () => {
    const text = "Remember to book the ramen place near Shibuya before we leave Tokyo entirely";
    const snip = snippetAround(text, "ramen", 10);
    expect(snip).toContain("ramen");
    expect(snip.startsWith("…")).toBe(true);
    expect(snip.endsWith("…")).toBe(true);
  });

  it("returns the head of the text when there's no match", () => {
    expect(snippetAround("short note", "zzz", 32)).toBe("short note");
  });
});

describe("searchNoteSections (ODY-083)", () => {
  const sections = [
    { id: "a", title: "Packing List", text: "passport, ramen coupons, umbrella" },
    { id: "b", title: "Reminders", text: "call the hotel" },
    { id: "c", title: "Ramen spots", text: "" },
  ];

  it("matches on body text, with a snippet", () => {
    const r = searchNoteSections(sections, "ramen");
    // section a (body) and section c (title) both match
    expect(r.map((m) => m.id).sort()).toEqual(["a", "c"]);
    expect(r.find((m) => m.id === "a")?.snippet).toContain("ramen");
  });

  it("matches on section title even with empty body", () => {
    const r = searchNoteSections(sections, "ramen spots");
    expect(r.some((m) => m.id === "c")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(searchNoteSections(sections, "PASSPORT").some((m) => m.id === "a")).toBe(true);
  });

  it("returns nothing for a too-short query", () => {
    expect(searchNoteSections(sections, "r")).toEqual([]);
  });

  it("caps results", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, title: "x", text: "match here" }));
    expect(searchNoteSections(many, "match", 3)).toHaveLength(3);
  });

  it("falls back to a title-only snippet when only the title matches", () => {
    const r = searchNoteSections(sections, "spots");
    const c = r.find((m) => m.id === "c");
    expect(c).toBeTruthy();
    expect(c?.snippet).toBe("");
  });
});
