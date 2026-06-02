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
  dayId: string;
  dayLabel: string;
  dayDate: string;
  globalIdx: number;
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
