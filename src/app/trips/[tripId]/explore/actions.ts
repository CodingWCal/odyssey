"use server";

import { db } from "@/lib/prisma/db";
import { exploreVibeSchema } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
import { searchPlaces } from "@/lib/geocode";
import { createPlace } from "@/app/trips/[tripId]/collections/actions";
import { createEvent } from "@/app/trips/[tripId]/itinerary/actions";
import type { EventType } from "@/types";

export type ExploreSuggestion = {
  id: string;
  title: string;
  location: string;
  category: EventType;
  blurb: string;
  lat: number;
  lng: number;
};

const VIBE_CATEGORY: Record<string, EventType> = {
  food: "restaurant",
  cafe: "restaurant",
  coffee: "restaurant",
  restaurant: "restaurant",
  eat: "restaurant",
  museum: "activity",
  hike: "activity",
  park: "activity",
  sunset: "activity",
  nightlife: "activity",
  beach: "activity",
  hotel: "hotel",
  stay: "hotel",
};

function guessCategory(vibe: string): EventType {
  const lower = vibe.toLowerCase();
  for (const [key, cat] of Object.entries(VIBE_CATEGORY)) {
    if (lower.includes(key)) return cat;
  }
  return "activity";
}

function shortTitle(display: string): string {
  const first = display.split(",")[0]?.trim() ?? display;
  return first.slice(0, 80) || "Suggested place";
}

/**
 * Vibe-based place suggestions for a trip destination (ODY-049).
 * Uses Nominatim via shared geocode helper (no browser→Nominatim).
 * LLM path can plug in later when OPENAI_API_KEY is configured.
 */
export async function exploreByVibe(input: unknown): Promise<ExploreSuggestion[]> {
  const dbUser = await getOrCreateDbUser();
  const { tripId, vibe } = exploreVibeSchema.parse(input);
  await assertTripRole(tripId, dbUser.id, "viewer");

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { destination: true },
  });
  if (!trip) throw new Error("Not found");

  const query = `${vibe} in ${trip.destination}`;
  const results = await searchPlaces(query, 5, { userKey: dbUser.clerkId });
  const category = guessCategory(vibe);

  return results.map((r, i) => ({
    id: `sug-${i}-${r.lat}-${r.lng}`,
    title: shortTitle(r.display),
    location: r.display,
    category,
    blurb: `A ${vibe.toLowerCase()} find near ${trip.destination}.`,
    lat: r.lat,
    lng: r.lng,
  }));
}

/** Save an Explore suggestion into Collections (ODY-050). */
export async function saveExploreToCollection(input: {
  tripId: string;
  title: string;
  location: string;
  category: EventType;
  notes?: string;
  lat: number;
  lng: number;
}) {
  return createPlace({
    tripId: input.tripId,
    title: input.title,
    location: input.location,
    category: input.category,
    notes: input.notes,
    lat: input.lat,
    lng: input.lng,
  });
}

/** Save an Explore suggestion as an itinerary event on a day (ODY-050). */
export async function saveExploreToItinerary(input: {
  tripId: string;
  dayId: string;
  title: string;
  location: string;
  category: EventType;
  notes?: string;
  lat: number;
  lng: number;
}) {
  return createEvent({
    tripId: input.tripId,
    dayId: input.dayId,
    type: input.category,
    title: input.title,
    location: input.location,
    notes: input.notes,
    lat: input.lat,
    lng: input.lng,
  });
}
