/**
 * Location-search query shaping (ODY-091). Pure + framework-free so it can be
 * unit-tested without the `server-only` geocode module.
 *
 * Nominatim ranks a bare place name ("ramen") globally, which makes trip
 * location entry feel broken. When we know the trip destination we gently bias
 * the query toward it — but only for bare names, so a full address the traveler
 * typed themselves is left untouched.
 */
export function buildBiasedQuery(query: string, near?: string | null): string {
  const q = query.trim();
  const n = (near ?? "").trim();
  if (!q) return "";
  if (!n) return q;
  // Structured input (contains a comma) — assume the user was specific.
  if (q.includes(",")) return q;
  // Already references the destination — don't duplicate it.
  if (q.toLowerCase().includes(n.toLowerCase())) return q;
  return `${q}, ${n}`;
}
