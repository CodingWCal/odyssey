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

/** One of the viewer's own packing items scoped to this event (ODY-067 Stage B). */
export interface PackingItem {
  id: string;
  label: string;
  done: boolean;
}

/** One leg of a multi-leg flight (ODY-144) — see src/lib/flightLegs.ts. */
export interface FlightLeg {
  flightNumber: string | null;
  from: string;
  fromLat: number | null;
  fromLng: number | null;
  to: string;
  toLat: number | null;
  toLng: number | null;
  /** 24h "HH:MM", same storage convention as Event.startTime/endTime. */
  departTime: string;
  arriveTime: string;
  operatedBy: string | null;
}

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
  confirmationCode: string | null;
  bookingUrl: string | null;
  checkIn: string | null;
  /** Free-text layover, flight-type only (ODY-128 minimal path), e.g. "1h 20m in Denver (DEN)".
   * Superseded by `legs` (ODY-144) once a flight has structured legs. */
  layover: string | null;
  /** Multi-leg flight segments (ODY-144), flight-type only. Null/empty means
   * a plain single-leg flight (or any other event) — unchanged behavior. */
  legs: FlightLeg[] | null;
  /** Multi-night lodging (hotel type only) — null means an ordinary same-day
   * event; set to a date after this event's own day turns it into an
   * all-day banner spanning every day of the stay. */
  checkOutDate: Date | null;
  createdBy: string;
  createdAt: Date;
  /** Populated only by the itinerary page fetch; absent elsewhere. */
  packingItems?: PackingItem[];
  /** This event's own day's date — populated only by the itinerary page
   * fetch, so AddEventModal can bound a lodging checkout date picker. */
  dayDate?: Date;
  /** Set only on a multi-night lodging entry in a day's all-day banner list
   * (never on a normal timed-list event) — which night of the stay this is. */
  lodgingPhase?: "check-in" | "staying" | "check-out";
}

/** A day in the trip, for the copy-events and move-to-day pickers. */
export interface DayOption {
  id: string;
  dayNumber: number;
  label: string;
  /** "YYYY-MM-DD" — bounds a lodging checkout date when moving to this day. */
  date: string;
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
