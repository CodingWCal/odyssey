/**
 * Display-only parsing for event notes (ODY-039). Storage stays the plain
 * string; this just decides how to lay it out: lines starting with -, * or •
 * become bullet items (consecutive ones grouped into one list), other lines
 * become paragraphs. Returns null when the note is a single plain line —
 * callers render it verbatim, exactly as before the feature.
 */

export type NoteChunk = { kind: "ul"; items: string[] } | { kind: "p"; text: string };

const BULLET_RE = /^[-*•]\s*/;

export function parseNoteChunks(text: string): NoteChunk[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1 && !BULLET_RE.test(lines[0] ?? "")) return null;

  const chunks: NoteChunk[] = [];
  for (const line of lines) {
    if (BULLET_RE.test(line)) {
      const item = line.replace(BULLET_RE, "");
      const last = chunks[chunks.length - 1];
      if (last?.kind === "ul") last.items.push(item);
      else chunks.push({ kind: "ul", items: [item] });
    } else {
      chunks.push({ kind: "p", text: line });
    }
  }
  return chunks;
}
