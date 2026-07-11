"use client";

import { useState } from "react";
import { Icons } from "@/components/shared/Icons";
import { AvatarStack } from "@/components/shared/AvatarStack";
import { TripEditModal } from "@/components/trips/TripEditModal";

interface ItineraryHeroProps {
  tripId: string;
  destination: string;
  dateRange: string;
  title: string;
  titleParts: { head: string; tail: string };
  members: { id: string; name: string }[];
  weather: { condition: string; temperature: number } | null;
  totalDays: number;
  totalEvents: number;
  trip: { startDate: Date; endDate: Date };
  /** Viewers can't edit trip details (ODY-001). */
  canEdit?: boolean;
}

const CONDITION_ICONS: Record<string, string> = {
  clear: "☀️", cloudy: "⛅", rain: "🌧", snow: "❄️",
  storm: "⛈", fog: "🌫", wind: "💨", default: "🌤",
};

export function ItineraryHero({
  tripId,
  destination,
  dateRange,
  title,
  titleParts,
  members,
  weather,
  totalDays,
  totalEvents,
  trip,
  canEdit = true,
}: ItineraryHeroProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <section className="hero" aria-label="Trip overview">
        <div className="hero-top">
          <div className="left">
            <div className="hero-eyebrow">{destination} · {dateRange}</div>
            <div className="hero-title-row">
              <h1 className="hero-title">{titleParts.head}<em>{titleParts.tail}</em></h1>
              {canEdit && (
                <button
                  className="icon-btn"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit trip"
                  title="Edit trip details"
                >
                  <Icons.edit size={16} />
                </button>
              )}
            </div>
          </div>
          {members.length > 0 && (
            <div className="hero-people" title="Collaborators">
              <AvatarStack members={members} />
              <span>{members.length} traveler{members.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        <div className="hero-row">
          {weather && (
            <>
              <span className="hero-weather">
                <span>{CONDITION_ICONS[weather.condition] ?? CONDITION_ICONS.default}</span>
                <span className="temp">{Math.round(weather.temperature)}°F</span>
                <span className="hero-cond">· {weather.condition}</span>
              </span>
              <span className="dot" />
            </>
          )}
          <span><strong>{totalDays} days</strong></span>
          <span className="dot" />
          <span>{totalEvents} planned events</span>
          <span className="dot" />
          <span><Icons.pin size={12} /> {destination}</span>
        </div>
      </section>

      <TripEditModal
        open={editOpen}
        tripId={tripId}
        initialTitle={title}
        initialDestination={destination}
        initialStartDate={trip.startDate}
        initialEndDate={trip.endDate}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}
