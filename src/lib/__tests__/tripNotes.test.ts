import { describe, it, expect } from "vitest";
import {
  applyPlainPatch,
  applyRichPatch,
  assertNotePayloadSize,
  normalizeTripNoteContent,
  NOTE_TEXT_MAX,
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
      })
    ).toThrow(/too long/i);
  });
});
