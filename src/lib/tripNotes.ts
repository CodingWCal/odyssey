/**
 * Shared trip-level Note.content shape (ODY-051).
 *
 * Legacy writers used incompatible JSON:
 * - TripNotes → `{ text }`
 * - TipTap → ProseMirror `{ type: "doc", ... }`
 * Last write blanked the other UI. Canonical v1 keeps both projections.
 */

export const NOTE_TEXT_MAX = 20_000;
export const NOTE_JSON_MAX = 100_000;

export type TripNoteDoc = {
  type: "doc";
  content?: Array<Record<string, unknown>>;
};

export type TripNoteContentV1 = {
  v: 1;
  text: string;
  doc: TripNoteDoc;
};

const EMPTY_DOC: TripNoteDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function emptyTripNote(): TripNoteContentV1 {
  return { v: 1, text: "", doc: EMPTY_DOC };
}

/** Build a minimal TipTap doc from plain lines (pinned notes → rich). */
export function docFromPlainText(text: string): TripNoteDoc {
  if (!text) return EMPTY_DOC;
  const lines = text.split(/\r?\n/);
  return {
    type: "doc",
    content: lines.map((line) =>
      line
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph" }
    ) as Array<Record<string, unknown>>,
  };
}

/** Flatten TipTap/ProseMirror JSON to plain text for the pinned card. */
export function plainTextFromDoc(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (typeof n.text === "string") return n.text;
  if (n.type === "hardBreak") return "\n";

  const kids = Array.isArray(n.content) ? n.content : [];
  const joined = kids.map(plainTextFromDoc).join("");

  if (n.type === "paragraph" || n.type === "heading" || n.type === "blockquote") {
    return joined + "\n";
  }
  if (n.type === "listItem") {
    return joined.endsWith("\n") ? joined : joined + "\n";
  }
  return joined;
}

function trimTrailingNewlines(s: string): string {
  return s.replace(/\n+$/, "");
}

function isDoc(value: unknown): value is TripNoteDoc {
  return !!value && typeof value === "object" && (value as { type?: string }).type === "doc";
}

/** Coerce any legacy or v1 Note.content into the canonical shape. */
export function normalizeTripNoteContent(raw: unknown): TripNoteContentV1 {
  if (!raw || typeof raw !== "object") return emptyTripNote();
  const o = raw as Record<string, unknown>;

  if (o.v === 1 && typeof o.text === "string" && isDoc(o.doc)) {
    return { v: 1, text: o.text, doc: o.doc };
  }

  // Legacy TipTap root document
  if (isDoc(raw) && o.v !== 1) {
    return {
      v: 1,
      text: trimTrailingNewlines(plainTextFromDoc(raw)),
      doc: raw,
    };
  }

  // Legacy pinned plain notes
  if (typeof o.text === "string") {
    return { v: 1, text: o.text, doc: docFromPlainText(o.text) };
  }

  return emptyTripNote();
}

export function applyPlainPatch(text: string): TripNoteContentV1 {
  return { v: 1, text, doc: docFromPlainText(text) };
}

export function applyRichPatch(doc: TripNoteDoc): TripNoteContentV1 {
  return {
    v: 1,
    text: trimTrailingNewlines(plainTextFromDoc(doc)),
    doc,
  };
}

export function assertNotePayloadSize(content: TripNoteContentV1): void {
  if (content.text.length > NOTE_TEXT_MAX) {
    throw new Error("Notes are too long");
  }
  if (JSON.stringify(content).length > NOTE_JSON_MAX) {
    throw new Error("Notes are too long");
  }
}
