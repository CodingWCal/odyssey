/**
 * Bullet/checklist line parsing for freeform notes text (ODY-105).
 * Storage stays plain text (no schema change) — checkbox state lives in
 * the "[ ]"/"[x]" marker itself, reusing ODY-039's "-"/"*" bullet convention.
 */

export type ChecklistLineType = "checkbox" | "bullet" | "text" | "blank";

export type ParsedChecklistLine = {
  type: ChecklistLineType;
  /** Content after the marker (for checkbox/bullet) or the raw line (text/blank). */
  text: string;
  checked?: boolean;
  lineIndex: number;
};

const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s?(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;

export function parseChecklistLines(text: string): ParsedChecklistLine[] {
  return text.split("\n").map((raw, lineIndex) => {
    if (raw.trim() === "") return { type: "blank", text: "", lineIndex };

    const cb = CHECKBOX_RE.exec(raw);
    if (cb) return { type: "checkbox", text: cb[2], checked: cb[1].toLowerCase() === "x", lineIndex };

    const bullet = BULLET_RE.exec(raw);
    if (bullet) return { type: "bullet", text: bullet[1], lineIndex };

    return { type: "text", text: raw, lineIndex };
  });
}

/** Flip one checkbox line's [ ]/[x] marker, leaving every other line untouched. */
export function toggleChecklistLine(text: string, lineIndex: number): string {
  const lines = text.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) return text;
  const match = CHECKBOX_RE.exec(line);
  if (!match) return text;
  const nextMark = match[1].toLowerCase() === "x" ? " " : "x";
  lines[lineIndex] = line.replace(CHECKBOX_RE, `- [${nextMark}] $2`);
  return lines.join("\n");
}

/** Append a new blank checklist item; returns the new text and the cursor
 * offset (end of the new line) so the caller can focus + place the caret. */
export function appendChecklistItem(text: string): { text: string; cursor: number } {
  const base = text.length > 0 && !text.endsWith("\n") ? text + "\n" : text;
  const next = base + "- [ ] ";
  return { text: next, cursor: next.length };
}

/** Character offset at the end of a given line — for placing the caret
 * when switching from the rendered checklist view into the raw textarea. */
export function lineEndOffset(text: string, lineIndex: number): number {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length && i <= lineIndex; i++) {
    offset += lines[i].length;
    if (i < lineIndex) offset += 1; // the "\n" joining this line to the next
  }
  return offset;
}
