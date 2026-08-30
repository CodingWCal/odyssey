"use client";

import { useState, useTransition } from "react";
import {
  exploreByVibe,
  saveExploreToCollection,
  saveExploreToItinerary,
  type ExploreSuggestion,
} from "@/app/trips/[tripId]/explore/actions";
import { Icons } from "@/components/shared/Icons";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { toast } from "@/components/shared/Toast";
import { formatShortDate } from "@/lib/utils";

const VIBE_CHIPS = [
  "cozy cafés",
  "sunset views",
  "local eats",
  "museums",
  "parks & walks",
  "nightlife",
];

interface DayOption {
  id: string;
  label: string;
  date: Date;
}

interface ExploreClientProps {
  tripId: string;
  destination: string;
  /** The trip's destination split into distinct places (multi-city trips). */
  destinations: string[];
  days: DayOption[];
  readOnly?: boolean;
}

export function ExploreClient({ tripId, destination, destinations, days, readOnly = false }: ExploreClientProps) {
  const multiDest = destinations.length > 1;
  const [activeDest, setActiveDest] = useState(destinations[0] ?? destination);
  const [vibe, setVibe] = useState("");
  const [results, setResults] = useState<ExploreSuggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dayPick, setDayPick] = useState<Record<string, string>>({});

  function runSearch(q: string, dest = activeDest) {
    const next = q.trim();
    if (next.length < 2) {
      toast("Pick or type a vibe first.");
      return;
    }
    setVibe(next);
    startTransition(async () => {
      try {
        const list = await exploreByVibe({ tripId, vibe: next, place: multiDest ? dest : undefined });
        setResults(list);
        setSearched(true);
        if (list.length === 0) toast("No places matched that vibe — try another.");
      } catch {
        toast("Explore couldn't search right now — try again.");
      }
    });
  }

  // Switch which city a multi-destination trip explores; re-run the current
  // vibe against the newly picked place so the list updates in one tap.
  function pickDest(dest: string) {
    if (dest === activeDest) return;
    setActiveDest(dest);
    if (searched && vibe.trim().length >= 2) runSearch(vibe, dest);
  }

  function handleSaveCollection(s: ExploreSuggestion) {
    if (readOnly) return;
    startTransition(async () => {
      try {
        await saveExploreToCollection({
          tripId,
          title: s.title,
          location: s.location,
          category: s.category,
          notes: s.blurb,
          lat: s.lat,
          lng: s.lng,
        });
        toast("Saved to Collections.", "success");
      } catch {
        toast("Couldn't save to Collections — try again.");
      }
    });
  }

  function handleSaveItinerary(s: ExploreSuggestion) {
    if (readOnly) return;
    const dayId = dayPick[s.id] || days[0]?.id;
    if (!dayId) {
      toast("This trip has no days to add to yet.");
      return;
    }
    startTransition(async () => {
      try {
        await saveExploreToItinerary({
          tripId,
          dayId,
          title: s.title,
          location: s.location,
          category: s.category,
          notes: s.blurb,
          lat: s.lat,
          lng: s.lng,
        });
        toast("Added to itinerary.", "success");
      } catch {
        toast("Couldn't add to itinerary — try again.");
      }
    });
  }

  return (
    <div className="explore-page">
      <header className="explore-head">
        <div>
          <div className="eyebrow">Near {multiDest ? activeDest : destination}</div>
          <h1 className="explore-title">
            Explore by <em>vibe</em>
          </h1>
          <p className="explore-sub">
            Describe the mood — cozy cafés, sunset views, local eats — and we&apos;ll suggest places you can save to the plan.
          </p>
        </div>
      </header>

      {multiDest && (
        <div className="explore-dests" role="group" aria-label="Which destination to explore">
          {destinations.map((d) => (
            <button
              key={d}
              type="button"
              className={`chip ${d === activeDest ? "active" : ""}`}
              onClick={() => pickDest(d)}
              disabled={isPending}
              aria-pressed={d === activeDest}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="explore-search">
        <div className="explore-chips">
          {VIBE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={`chip ${vibe === chip ? "active" : ""}`}
              onClick={() => runSearch(chip)}
              disabled={isPending}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="explore-input-row">
          <input
            className="input"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch(vibe);
            }}
            placeholder="Or type your own vibe…"
            aria-label="Vibe"
          />
          <button className="btn btn-primary" type="button" onClick={() => runSearch(vibe)} disabled={isPending}>
            {isPending ? "Searching…" : "Explore"}
          </button>
        </div>
      </div>

      {searched && results.length === 0 && !isPending && (
        <div className="empty-card tall">
          <p className="glyph sm" aria-hidden="true">🔍</p>
          <p className="headline soft">Nothing turned up.</p>
          <p className="sub mt">Try a broader vibe or a different neighborhood word.</p>
        </div>
      )}

      <ul className="explore-list">
        {results.map((s) => (
          <li key={s.id} className="explore-card">
            <div className="explore-card-body">
              <div className="explore-card-meta">
                <TypeBadge type={s.category} />
              </div>
              <h3>{s.title}</h3>
              <p className="explore-loc">
                <Icons.pin size={12} /> {s.location}
              </p>
              <p className="explore-blurb">{s.blurb}</p>
            </div>
            {!readOnly && (
              <div className="explore-card-actions">
                {days.length > 0 && (
                  <label className="explore-day-pick">
                    <span className="sr-only">Day</span>
                    <select
                      className="input"
                      value={dayPick[s.id] || days[0].id}
                      onChange={(e) => setDayPick((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    >
                      {days.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label} · {formatShortDate(d.date)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button type="button" className="btn btn-primary" disabled={isPending} onClick={() => handleSaveItinerary(s)}>
                  Add to itinerary
                </button>
                <button type="button" className="btn btn-ghost" disabled={isPending} onClick={() => handleSaveCollection(s)}>
                  Save to collections
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
