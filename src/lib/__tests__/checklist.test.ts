import { describe, it, expect } from "vitest";
import { appendChecklistItem, lineEndOffset, parseChecklistLines, toggleChecklistLine } from "@/lib/checklist";

describe("parseChecklistLines (ODY-105)", () => {
  it("parses a mix of checkbox, bullet, plain, and blank lines", () => {
    const text = "Trip vibe check\n- [ ] buy sunscreen\n- [x] book flights\n- loose bullet\n\nplain line";
    const lines = parseChecklistLines(text);
    expect(lines.map((l) => l.type)).toEqual(["text", "checkbox", "checkbox", "bullet", "blank", "text"]);
    expect(lines[1]).toMatchObject({ text: "buy sunscreen", checked: false });
    expect(lines[2]).toMatchObject({ text: "book flights", checked: true });
    expect(lines[3]).toMatchObject({ text: "loose bullet" });
  });

  it("treats * the same as - for bullets and checkboxes", () => {
    const lines = parseChecklistLines("* [ ] star checkbox\n* star bullet");
    expect(lines[0]).toMatchObject({ type: "checkbox", checked: false, text: "star checkbox" });
    expect(lines[1]).toMatchObject({ type: "bullet", text: "star bullet" });
  });

  it("handles an empty checkbox item (no trailing text)", () => {
    const lines = parseChecklistLines("- [ ]");
    expect(lines[0]).toMatchObject({ type: "checkbox", checked: false, text: "" });
  });
});

describe("toggleChecklistLine (ODY-105)", () => {
  it("checks an unchecked item without touching other lines", () => {
    const text = "keep me\n- [ ] buy sunscreen\nkeep me too";
    const next = toggleChecklistLine(text, 1);
    expect(next).toBe("keep me\n- [x] buy sunscreen\nkeep me too");
  });

  it("unchecks a checked item", () => {
    const next = toggleChecklistLine("- [x] book flights", 0);
    expect(next).toBe("- [ ] book flights");
  });

  it("is a no-op on a non-checkbox line", () => {
    const text = "- loose bullet\nplain line";
    expect(toggleChecklistLine(text, 0)).toBe(text);
    expect(toggleChecklistLine(text, 1)).toBe(text);
  });

  it("is a no-op for an out-of-range line index", () => {
    const text = "- [ ] item";
    expect(toggleChecklistLine(text, 5)).toBe(text);
  });
});

describe("appendChecklistItem (ODY-105)", () => {
  it("appends a blank checklist line to existing text with a newline", () => {
    const { text, cursor } = appendChecklistItem("existing note");
    expect(text).toBe("existing note\n- [ ] ");
    expect(cursor).toBe(text.length);
  });

  it("doesn't double up a trailing newline", () => {
    const { text } = appendChecklistItem("existing note\n");
    expect(text).toBe("existing note\n- [ ] ");
  });

  it("works from empty text", () => {
    const { text, cursor } = appendChecklistItem("");
    expect(text).toBe("- [ ] ");
    expect(cursor).toBe(text.length);
  });
});

describe("lineEndOffset (ODY-105)", () => {
  it("finds the end offset of each line in a multi-line note", () => {
    const text = "one\ntwo\nthree";
    expect(lineEndOffset(text, 0)).toBe(3); // end of "one"
    expect(lineEndOffset(text, 1)).toBe(7); // end of "one\ntwo"
    expect(lineEndOffset(text, 2)).toBe(13); // end of the whole string
  });

  it("handles the first and only line", () => {
    expect(lineEndOffset("solo line", 0)).toBe(9);
  });
});
