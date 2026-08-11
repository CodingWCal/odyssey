/** Server-query invariant: a traveler sees shared items plus only their own. */
export function visiblePackingWhere(tripId: string, userId: string) {
  return { tripId, OR: [{ ownerId: null }, { ownerId: userId }] };
}
