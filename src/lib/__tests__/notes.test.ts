import { describe, it, expect } from "vitest";
import { parseNoteChunks } from "@/lib/notes";

describe("parseNoteChunks (ODY-039)", () => {
  it("returns null for a single plain line (renders verbatim)", () => {
    expect(parseNoteChunks("gate closes 30 min early")).toBeNull();
  });

  it("returns null for empty/whitespace text", () => {
    expect(parseNoteChunks("")).toBeNull();
    expect(parseNoteChunks("   \n  ")).toBeNull();
  });

  it("groups consecutive dash lines into one bullet list", () => {
    expect(parseNoteChunks("- passport\n- check in online\n- gate closes early")).toEqual([
      { kind: "ul", items: ["passport", "check in online", "gate closes early"] },
    ]);
  });

  it("supports *, • and marker-less mixing with paragraphs", () => {
    expect(parseNoteChunks("Bring:\n* passport\n• visa\nMeet at 9am")).toEqual([
      { kind: "p", text: "Bring:" },
      { kind: "ul", items: ["passport", "visa"] },
      { kind: "p", text: "Meet at 9am" },
    ]);
  });

  it("treats a single bullet line as a list", () => {
    expect(parseNoteChunks("- just one thing")).toEqual([
      { kind: "ul", items: ["just one thing"] },
    ]);
  });

  it("splits plain multi-line notes into paragraphs", () => {
    expect(parseNoteChunks("first thought\nsecond thought")).toEqual([
      { kind: "p", text: "first thought" },
      { kind: "p", text: "second thought" },
    ]);
  });

  it("ignores blank lines and CRLF endings", () => {
    expect(parseNoteChunks("- a\r\n\r\n- b")).toEqual([{ kind: "ul", items: ["a", "b"] }]);
  });

  it("does not treat mid-line dashes as bullets", () => {
    expect(parseNoteChunks("check-in at 3pm\nroom 401-B")).toEqual([
      { kind: "p", text: "check-in at 3pm" },
      { kind: "p", text: "room 401-B" },
    ]);
  });
});
