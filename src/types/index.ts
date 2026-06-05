export type EventType =
  | "flight"
  | "hotel"
  | "restaurant"
  | "activity"
  | "transport"
  | "misc";

export type ExpenseCategory =
  | "flights"
  | "lodging"
  | "food"
  | "transport"
  | "activities"
  | "misc";

export type MemberRole = "owner" | "editor";

export interface TripEvent {
  id: string;
  dayId: string;
  tripId: string;
  type: EventType;
  title: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  cost: number | null;
  orderIndex: number;
  lat: number | null;
  lng: number | null;
  destLocation: string | null;
  destLat: number | null;
  destLng: number | null;
  createdBy: string;
  createdAt: Date;
}

export interface TripDay {
  id: string;
  tripId: string;
  date: Date;
  label: string | null;
  notes: string | null;
  events: TripEvent[];
}

export interface Trip {
  id: string;
  ownerId: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  coverImageUrl: string | null;
  totalBudget: number | null;
  createdAt: Date;
}

export interface TripWithDetails extends Trip {
  members: TripMember[];
  days: TripDay[];
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  role: MemberRole;
  splitWeight: number;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface Expense {
  id: string;
  tripId: string;
  eventId: string | null;
  label: string;
  amount: number;
  category: ExpenseCategory;
  addedBy: string;
  createdAt: Date;
}

export type AvailabilityBlock = "all_day" | "morning" | "afternoon" | "evening";

export type AvailabilityStatus = "available" | "maybe" | "unavailable";

export interface AvailabilitySlot {
  id: string;
  tripId: string;
  userId: string;
  date: Date;
  block: AvailabilityBlock;
  status: AvailabilityStatus;
  source: string;
  updatedAt: Date;
}

export interface AvailabilityPoll {
  id: string;
  tripId: string;
  rangeStart: Date;
  rangeEnd: Date;
  enabledBlocks: AvailabilityBlock[];
  desiredLengthDays: number | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  flight: "#D9634F",
  hotel: "#4A6B8C",
  restaurant: "#F0A08A",
  activity: "#5DCAA5",
  transport: "#7F77C0",
  misc: "#F5D9B0",
};

export const EVENT_TYPE_BG: Record<EventType, string> = {
  flight: "bg-odyssey-coral text-white",
  hotel: "bg-odyssey-slate text-white",
  restaurant: "bg-odyssey-peach text-odyssey-ink",
  activity: "bg-odyssey-teal text-white",
  transport: "bg-odyssey-periwinkle text-white",
  misc: "bg-odyssey-cream text-odyssey-ink",
};
