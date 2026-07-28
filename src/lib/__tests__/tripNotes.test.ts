import { describe, it, expect } from "vitest";
import {
  applyPlainPatch,
  applyRichPatch,
  applySectionsPatch,
  assertNotePayloadSize,
  defaultNoteSections,
  normalizeTripNoteContent,
  NOTE_TEXT_MAX,
  NOTE_SECTIONS_MAX,
} from "@/lib/tripNotes";
import { upsertNotePatchSchema } from "@/lib/validations";

describe("normalizeTripNoteContent (ODY-051)", () => {
  it("upgrades legacy { text } into v1 with a matching doc", () => {
    const n = normalizeTripNoteContent({ text: "pack sunscreen" });
    expect(n.v).toBe(1);
    expect(n.text).toBe("pack sunscreen");
    expect(n.doc.type).toBe("doc");
    expect(JSON.stringify(n.doc)).toContain("pack sunscreen");
  });

  it("upgrades legacy TipTap doc and projects plain text", () => {
    const doc = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "World" }],
        },
      ],
    };
    const n = normalizeTripNoteContent(doc);
    expect(n.v).toBe(1);
    expect(n.text).toBe("Hello\nWorld");
    expect(n.doc).toEqual(doc);
  });

  it("passes through v1 unchanged", () => {
    const v1 = applyPlainPatch("keep me");
    expect(normalizeTripNoteContent(v1)).toEqual(v1);
  });
});

describe("plain / rich patches do not blank each other (ODY-051)", () => {
  it("plain patch keeps readable text and a doc projection", () => {
    const next = applyPlainPatch("pinned only");
    expect(next.text).toBe("pinned only");
    expect(next.doc.type).toBe("doc");
  });

  it("rich patch updates text projection so pinned notes stay filled", () => {
    const doc = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "From TipTap" }],
        },
      ],
    };
    const next = applyRichPatch(doc);
    expect(next.text).toBe("From TipTap");
    expect(next.doc).toEqual(doc);
  });
});

describe("note size guards (ODY-051)", () => {
  it("rejects oversized plain text via Zod", () => {
    expect(
      upsertNotePatchSchema.safeParse({ text: "x".repeat(NOTE_TEXT_MAX + 1) }).success
    ).toBe(false);
  });

  it("accepts a normal plain patch", () => {
    expect(upsertNotePatchSchema.safeParse({ text: "ok" }).success).toBe(true);
  });

  it("assertNotePayloadSize throws when text is too long", () => {
    expect(() =>
      assertNotePayloadSize({
        v: 1,
        text: "x".repeat(NOTE_TEXT_MAX + 1),
        doc: { type: "doc", content: [{ type: "paragraph" }] },
        sections: [],
      })
    ).toThrow(/too long/i);
  });
});

describe("shared notes sections (ODY-104)", () => {
  it("defaultNoteSections seeds three named, empty sections", () => {
    const sections = defaultNoteSections();
    expect(sections.map((s) => s.title)).toEqual([
      "Important Reminders",
      "Packing List",
      "To Do",
    ]);
    expect(sections.every((s) => s.text === "")).toBe(true);
  });

  it("applySectionsPatch updates sections without touching text/doc", () => {
    const current = applyPlainPatch("pinned note", defaultNoteSections());
    const next = applySectionsPatch(current, [{ id: "a", title: "Groceries", text: "eggs" }]);
    expect(next.text).toBe("pinned note");
    expect(next.doc).toEqual(current.doc);
    expect(next.sections).toEqual([{ id: "a", title: "Groceries", text: "eggs" }]);
  });

  it("applyPlainPatch/applyRichPatch carry sections through instead of dropping them", () => {
    const sections = [{ id: "a", title: "Packing List", text: "socks" }];
    expect(applyPlainPatch("hi", sections).sections).toEqual(sections);
    expect(applyRichPatch({ type: "doc", content: [{ type: "paragraph" }] }, sections).sections).toEqual(sections);
  });

  it("normalizeTripNoteContent round-trips valid sections and drops malformed ones", () => {
    const raw = {
      v: 1,
      text: "hi",
      doc: { type: "doc", content: [{ type: "paragraph" }] },
      sections: [
        { id: "a", title: "To Do", text: "call venue" },
        { id: "b", title: 5, text: "bad shape, should be dropped" },
        "not even an object",
      ],
    };
    const n = normalizeTripNoteContent(raw);
    expect(n.sections).toEqual([{ id: "a", title: "To Do", text: "call venue" }]);
  });

  it("normalizeTripNoteContent defaults sections to [] for legacy content with none", () => {
    expect(normalizeTripNoteContent({ text: "legacy note" }).sections).toEqual([]);
  });

  it("Zod rejects more than NOTE_SECTIONS_MAX sections", () => {
    const tooMany = Array.from({ length: NOTE_SECTIONS_MAX + 1 }, (_, i) => ({
      id: `s${i}`,
      title: "Section",
      text: "",
    }));
    expect(upsertNotePatchSchema.safeParse({ sections: tooMany }).success).toBe(false);
  });

  it("Zod accepts a normal sections patch", () => {
    expect(
      upsertNotePatchSchema.safeParse({
        sections: [{ id: "a", title: "Packing List", text: "sunscreen" }],
      }).success
    ).toBe(true);
  });
});
