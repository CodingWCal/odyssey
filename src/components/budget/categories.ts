import { Icons } from "@/components/shared/Icons";

export const CATEGORIES = ["flights", "lodging", "food", "transport", "activities", "misc"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CAT_LABEL: Record<Category, string> = {
  flights: "Flights",
  lodging: "Lodging",
  food: "Food",
  transport: "Transport",
  activities: "Activities",
  misc: "Misc",
};

// Reuse the event-type icons for matching categories.
export const CAT_ICON: Record<Category, (typeof Icons)[keyof typeof Icons]> = {
  flights: Icons.flight,
  lodging: Icons.hotel,
  food: Icons.restaurant,
  transport: Icons.transport,
  activities: Icons.activity,
  misc: Icons.misc,
};
