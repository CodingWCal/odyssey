import type { EventType } from "@/types";

export interface MapEvent {
  id: string;
  type: EventType;
  title: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  cost: number | null;
  notes: string | null;
  lat: number;
  lng: number;
  destLocation: string | null;
  destLat: number | null;
  destLng: number | null;
  // Line to draw for point-to-point events (flight/transport). Either explicit
  // (origin → arrival) or inferred for transport (origin → next stop same day).
  routePath: [number, number][] | null;
  routeInferred: boolean;
  dayId: string;
  dayLabel: string;
  dayDate: string;
  globalIdx: number;
}

/** Candidate place pin (ODY-045) — distinct from itinerary MapEvent markers. */
export interface MapPlace {
  id: string;
  category: EventType;
  title: string;
  location: string | null;
  notes: string | null;
  lat: number;
  lng: number;
}

export interface MapDay {
  id: string;
  label: string;
  dateShort: string;
  events: MapEvent[];
}

// Marker / pin colors per event type (design TYPE_HEX).
export const TYPE_HEX: Record<EventType, string> = {
  flight: "#C9533F",
  hotel: "#D6A24A",
  restaurant: "#E68A6D",
  activity: "#2E9D7F",
  transport: "#6F66B7",
  misc: "#4A6B8C",
};

// Human labels for the type — the non-color channel (ODY-118 F11) so pin type
// reads for color-blind users via the map list and tooltips, not hue alone.
export const TYPE_LABEL: Record<EventType, string> = {
  flight: "Flight",
  hotel: "Hotel",
  restaurant: "Restaurant",
  activity: "Activity",
  transport: "Transport",
  misc: "Misc",
};

export const PLACE_CATEGORIES: EventType[] = [
  "restaurant",
  "activity",
  "hotel",
  "flight",
  "transport",
  "misc",
];
