import { Icons } from "@/components/shared/Icons";

export const NAV_ITEMS = [
  { href: "schedule", label: "Schedule", Icon: Icons.schedule },
  { href: "itinerary", label: "Itinerary", Icon: Icons.itinerary },
  { href: "explore", label: "Explore", Icon: Icons.explore },
  { href: "collections", label: "Collections", Icon: Icons.collections },
  { href: "map", label: "Map", Icon: Icons.map },
  { href: "budget", label: "Budget", Icon: Icons.budget },
  { href: "members", label: "Members", Icon: Icons.members },
] as const;
