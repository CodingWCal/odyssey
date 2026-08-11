import { Icons } from "@/components/shared/Icons";

// `core` destinations live on the mobile bottom tab bar; the rest surface
// through the hamburger drawer in the mobile trip header (ODY-059). Desktop's
// WorkspaceSidebar shows the core set plus whichever non-core tabs have
// earned their place (see splitDesktopNav / ODY-075).
export const NAV_ITEMS = [
  { href: "schedule", label: "Schedule", Icon: Icons.schedule, core: false },
  { href: "itinerary", label: "Itinerary", Icon: Icons.itinerary, core: true },
  { href: "explore", label: "Explore", Icon: Icons.explore, core: false },
  { href: "collections", label: "Collections", Icon: Icons.collections, core: true },
  { href: "map", label: "Map", Icon: Icons.map, core: true },
  { href: "budget", label: "Budget", Icon: Icons.budget, core: true },
  { href: "members", label: "Members", Icon: Icons.members, core: false },
  { href: "packing", label: "Packing", Icon: Icons.note, core: false },
] as const;

export const CORE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.core);
export const MORE_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.core);

export type NavItem = (typeof NAV_ITEMS)[number];

/**
 * Trip-state signals that decide whether a non-core tab is relevant yet
 * (ODY-075). Every trip in this app is created with a destination and dates
 * already set, so "reveal once a destination exists" (the original ticket
 * wording) would always be true and hide nothing — these are the real
 * "has the traveler engaged with this feature yet" signals instead.
 */
export interface TripNavState {
  /** An availability poll has been opened — Schedule is in active use. */
  hasPoll: boolean;
  /** At least one place has been saved — Explore/Collections have content. */
  hasPlaces: boolean;
  /** More than the creator is on the trip — Members is worth surfacing. */
  memberCount: number;
  hasPackingItems: boolean;
}

/** When each non-core tab graduates from the "More" group into the primary
 * sidebar. Core tabs are always primary and never appear here. */
const REVEAL: Record<string, (s: TripNavState) => boolean> = {
  schedule: (s) => s.hasPoll,
  explore: (s) => s.hasPlaces,
  members: (s) => s.memberCount > 1,
  packing: (s) => s.hasPackingItems,
};

/**
 * Split the desktop sidebar nav into the always-visible primary group and a
 * collapsed "More" group (ODY-075). A non-core tab is primary when its reveal
 * condition is met OR it's the page you're currently on — so the active tab is
 * never hidden and you never lose your place. Array order is preserved, so the
 * familiar vertical order is unchanged; unrevealed tabs simply drop into More.
 */
export function splitDesktopNav(
  state: TripNavState,
  isActive: (href: string) => boolean
): { primary: NavItem[]; more: NavItem[] } {
  const primary: NavItem[] = [];
  const more: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    const revealed = item.core || isActive(item.href) || (REVEAL[item.href]?.(state) ?? false);
    (revealed ? primary : more).push(item);
  }
  return { primary, more };
}
