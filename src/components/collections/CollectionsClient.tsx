"use client";

import { useState, useTransition } from "react";
import { addPlaceToItinerary, createPlace, deletePlace } from "@/app/trips/[tripId]/collections/actions";
import { LocationAutocomplete } from "@/components/itinerary/LocationAutocomplete";
import { Icons, EVENT_TYPES } from "@/components/shared/Icons";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { toast } from "@/components/shared/Toast";
import { formatShortDate } from "@/lib/utils";
import { TYPE_HEX } from "@/components/map/mapTypes";
import type { EventType } from "@/types";

export interface CollectionPlace {
  id: string;
  category: string;
  title: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

interface DayOption {
  id: string;
  label: string;
  date: Date;
}

interface CollectionsClientProps {
  tripId: string;
  places: CollectionPlace[];
  /** Trip days for the "add to itinerary" picker (ODY-078). */
  days: DayOption[];
  readOnly?: boolean;
  /** Trip destination — biases location search toward it (ODY-091). */
  destination?: string;
}

export function CollectionsClient({ tripId, places: initial, days, readOnly = false, destination }: CollectionsClientProps) {
  const [places, setPlaces] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [dayPick, setDayPick] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    category: "restaurant" as EventType,
    title: "",
    location: "",
    notes: "",
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
  });

  // Sync after revalidation
  const sig = JSON.stringify(initial);
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setPlaces(initial);
  }

  function resetForm() {
    setForm({
      category: "restaurant",
      title: "",
      location: "",
      notes: "",
      lat: undefined,
      lng: undefined,
    });
  }

  function handleCreate() {
    if (!form.title.trim()) {
      toast("Give this place a title first.");
      return;
    }
    startTransition(async () => {
      try {
        const place = await createPlace({
          tripId,
          category: form.category,
          title: form.title,
          location: form.location || undefined,
          notes: form.notes || undefined,
          lat: form.lat,
          lng: form.lng,
        });
        setPlaces((prev) => [place as CollectionPlace, ...prev]);
        resetForm();
        setAdding(false);
        toast("Saved to your collection.", "success");
      } catch {
        toast("Couldn't save that place — try again.");
      }
    });
  }

  function handleDelete(id: string, title: string) {
    startTransition(async () => {
      try {
        await deletePlace(id);
        setPlaces((prev) => prev.filter((p) => p.id !== id));
      } catch {
        toast(`Couldn't remove "${title}" — try again.`);
      }
    });
  }

  // Promote a saved place onto the itinerary on the picked day (ODY-078).
  function handleAddToItinerary(p: CollectionPlace) {
    if (readOnly) return;
    const dayId = dayPick[p.id] || days[0]?.id;
    if (!dayId) {
      toast("This trip has no days to add to yet.");
      return;
    }
    startTransition(async () => {
      try {
        await addPlaceToItinerary({ tripId, dayId, placeId: p.id });
        toast("Added to itinerary.", "success");
      } catch {
        toast("Couldn't add to itinerary — try again.");
      }
    });
  }

  const byCategory = EVENT_TYPES.map((cat) => ({
    cat,
    items: places.filter((p) => p.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="collections-page">
      <header className="collections-head">
        <div>
          <div className="eyebrow">Possibilities</div>
          <h1 className="collections-title">
            Place <em>collection</em>
          </h1>
          <p className="collections-sub">
            Spots you&apos;re considering — not on the itinerary yet. They show on the map by category.
          </p>
        </div>
        {!readOnly && (
          <button className="btn btn-primary" type="button" onClick={() => setAdding((a) => !a)}>
            <Icons.plus size={14} /> {adding ? "Cancel" : "Add place"}
          </button>
        )}
      </header>

      {adding && !readOnly && (
        <div className="collections-form">
          <div className="field">
            <label>Category</label>
            <div className="type-grid">
              {EVENT_TYPES.map((tp) => {
                const Icon = Icons[tp];
                return (
                  <button
                    key={tp}
                    type="button"
                    className={`type-chip t-${tp} ${form.category === tp ? "selected" : ""}`}
                    onClick={() => setForm((s) => ({ ...s, category: tp }))}
                  >
                    <Icon size={16} />
                    {tp}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="field">
            <label htmlFor="place-title">Title</label>
            <input
              id="place-title"
              className="input"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Sushi Dai"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="place-loc">Location</label>
            <LocationAutocomplete
              id="place-loc"
              value={form.location}
              placeholder="Neighborhood or address"
              near={destination}
              onChange={(text) => setForm((s) => ({ ...s, location: text, lat: undefined, lng: undefined }))}
              onPick={(s) => setForm((f) => ({ ...f, location: s.display, lat: s.lat, lng: s.lng }))}
            />
          </div>
          <div className="field">
            <label htmlFor="place-notes">Notes</label>
            <textarea
              id="place-notes"
              className="input"
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Why save this? Hours, vibe…"
            />
          </div>
          <div className="collections-form-foot">
            <button className="btn btn-ghost" type="button" onClick={() => { setAdding(false); resetForm(); }} disabled={isPending}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" onClick={handleCreate} disabled={isPending || !form.title.trim()}>
              {isPending ? "Saving…" : "Save place"}
            </button>
          </div>
        </div>
      )}

      {places.length === 0 ? (
        <div className="empty-card tall">
          <p className="glyph sm" aria-hidden="true">📌</p>
          <p className="headline soft">No places saved yet.</p>
          <p className="sub mt">
            {readOnly
              ? "Editors can add candidate spots that aren't on the day plan."
              : "Add restaurants, attractions, and maybes — they'll appear on the map."}
          </p>
        </div>
      ) : (
        <div className="collections-groups">
          {byCategory.map(({ cat, items }) => (
            <section key={cat} className="collections-group">
              <header className="collections-group-head">
                <span
                  className="collections-swatch"
                  style={{ "--swatch": TYPE_HEX[cat] } as React.CSSProperties}
                  aria-hidden="true"
                />
                <TypeBadge type={cat} />
                <span className="collections-count">{items.length}</span>
              </header>
              <ul className="collections-list">
                {items.map((p) => (
                  <li key={p.id} className="collections-item">
                    <div className="collections-item-body">
                      <h3>{p.title}</h3>
                      {p.location && (
                        <p className="collections-loc">
                          <Icons.pin size={12} /> {p.location}
                        </p>
                      )}
                      {p.notes && <p className="collections-notes">{p.notes}</p>}
                      {p.lat == null && (
                        <p className="collections-warn">No map pin yet — add a more specific location.</p>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="collections-item-actions">
                        {days.length > 0 && (
                          <label className="explore-day-pick">
                            <span className="sr-only">Day to add {p.title} to</span>
                            <select
                              className="input"
                              value={dayPick[p.id] || days[0].id}
                              onChange={(e) => setDayPick((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            >
                              {days.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.label} · {formatShortDate(d.date)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {days.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-primary sm"
                            disabled={isPending}
                            onClick={() => handleAddToItinerary(p)}
                          >
                            Add to itinerary
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn danger"
                          aria-label={`Remove ${p.title}`}
                          disabled={isPending}
                          onClick={() => handleDelete(p.id, p.title)}
                        >
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
