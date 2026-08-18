/**
 * Pure text-matching helpers for in-trip search (ODY-083). The event/place
 * matching is a DB `contains` query in the server action; this module holds
 * the parts worth unit-testing: the minimum-length gate and the note-section
 * search (which runs in JS over the notes JSON, not in SQL).
 */

/** Minimum query length before we search — avoids matching every row on "a". */
export const MIN_QUERY_LENGTH = 2;

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

export interface NoteSectionMatch {
  id: string;
  title: string;
  snippet: string;
}

/** A short snippet of `text` centered on the first match of `query`, with
 * ellipses where it was trimmed. Falls back to the head of the text. */
export function snippetAround(text: string, query: string, pad = 32): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, pad * 2).trim();
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + query.length + pad);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Sections whose title or body contains the query (case-insensitive), each
 * with a snippet, capped. */
export function searchNoteSections(
  sections: { id: string; title: string; text: string }[],
  query: string,
  maxResults = 5
): NoteSectionMatch[] {
  const q = query.trim().toLowerCase();
  if (!isSearchable(q)) return [];
  const out: NoteSectionMatch[] = [];
  for (const s of sections) {
    const inTitle = s.title.toLowerCase().includes(q);
    const inText = s.text.toLowerCase().includes(q);
    if (!inTitle && !inText) continue;
    out.push({
      id: s.id,
      title: s.title || "Note",
      snippet: inText ? snippetAround(s.text, q) : s.text.slice(0, 64).trim(),
    });
    if (out.length >= maxResults) break;
  }
  return out;
}
