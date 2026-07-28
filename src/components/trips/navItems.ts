import { Icons } from "@/components/shared/Icons";

// `core` destinations live on the mobile bottom tab bar; the rest surface
// through the hamburger drawer in the mobile trip header (ODY-059). Desktop's
// WorkspaceSidebar shows every item regardless of this flag.
export const NAV_ITEMS = [
  { href: "schedule", label: "Schedule", Icon: Icons.schedule, core: false },
  { href: "itinerary", label: "Itinerary", Icon: Icons.itinerary, core: true },
  { href: "explore", label: "Explore", Icon: Icons.explore, core: false },
  { href: "collections", label: "Collections", Icon: Icons.collections, core: true },
  { href: "map", label: "Map", Icon: Icons.map, core: true },
  { href: "budget", label: "Budget", Icon: Icons.budget, core: true },
  { href: "members", label: "Members", Icon: Icons.members, core: false },
] as const;

export const CORE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.core);
export const MORE_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.core);
