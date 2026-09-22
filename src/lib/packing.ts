/** Server-query invariant: a traveler sees shared items plus only their own. */
export function visiblePackingWhere(tripId: string, userId: string) {
  return { tripId, OR: [{ ownerId: null }, { ownerId: userId }] };
}

/** A day/event's packing item, as surfaced on the itinerary (ODY-067 Stage B). */
export interface EventPackingItem {
  id: string;
  label: string;
  done: boolean;
}

/**
 * Group a flat list of (already-visibility-filtered) checklist items by the
 * event they're scoped to. Pure — the caller does the actual `eventId: {
 * not: null }` query via `visiblePackingWhere`; event-scoped items are
 * always personal (see ChecklistItem.eventId's schema comment), so that
 * query already restricts this to the caller's own items.
 */
export function groupPackingItemsByEvent(
  items: { id: string; eventId: string | null; label: string; done: boolean }[]
): Map<string, EventPackingItem[]> {
  const byEvent = new Map<string, EventPackingItem[]>();
  for (const item of items) {
    if (!item.eventId) continue;
    const list = byEvent.get(item.eventId) ?? [];
    list.push({ id: item.id, label: item.label, done: item.done });
    byEvent.set(item.eventId, list);
  }
  return byEvent;
}
