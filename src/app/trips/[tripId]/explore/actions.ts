"use server";

import { db } from "@/lib/prisma/db";
import { exploreVibeSchema } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
import { searchPlacesByVibe } from "@/lib/places";
import { splitDestinations } from "@/lib/destinations";
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

/**
 * Vibe-based place suggestions for a trip destination (ODY-049). Resolves the
 * vibe to an OpenStreetMap category and pulls real, named points of interest
 * near the destination via the Overpass API (see lib/places.ts). Keyless; an
 * optional LLM ranking layer can plug in later when a provider key is added.
 */
export async function exploreByVibe(input: unknown): Promise<ExploreSuggestion[]> {
  const dbUser = await getOrCreateDbUser();
  const { tripId, vibe, place } = exploreVibeSchema.parse(input);
  await assertTripRole(tripId, dbUser.id, "viewer");

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { destination: true },
  });
  if (!trip) throw new Error("Not found");

  // Anchor on a chosen destination segment for a multi-city trip, but only
  // when it's genuinely one of this trip's destinations — never geocode an
  // arbitrary caller-supplied string. Otherwise search the full destination.
  const anchor =
    place && splitDestinations(trip.destination).includes(place) ? place : trip.destination;

  const results = await searchPlacesByVibe(vibe, anchor, dbUser.clerkId, 8);

  return results.map((r, i) => ({
    id: `sug-${i}-${r.lat}-${r.lng}`,
    ...r,
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
