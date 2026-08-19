"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { Icons } from "@/components/shared/Icons";
import { RouteLine } from "@/components/shared/RouteLine";
import { PLACE_CATEGORIES, TYPE_HEX, type MapDay, type MapEvent, type MapPlace } from "./mapTypes";
import { formatTime, type TimeFormat } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { EventType } from "@/types";

const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="map-loading" />,
});

interface MapClientProps {
  days: MapDay[];
  events: MapEvent[];
  places?: MapPlace[];
  eyebrow: string;
  dayCount: number;
  /** Trip-level 12h/24h display preference (ODY-041). */
  timeFormat?: TimeFormat;
  /** Trip base currency for cost display (ODY-024). */
  currency?: string;
  /** Stops with a written location that couldn't be geocoded (ODY-079). */
  unpinnedCount?: number;
}

export function MapClient({
  days,
  events,
  places = [],
  eyebrow,
  dayCount,
  timeFormat = "12h",
  currency = "USD",
  unpinnedCount = 0,
}: MapClientProps) {
  const [activeDay, setActiveDay] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const [placeCats, setPlaceCats] = useState<Set<EventType> | "all">("all");

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;
  const selectedPlace = places.find((p) => p.id === selectedId) ?? null;
  const visibleDays = days.filter((d) => activeDay === "all" || d.id === activeDay);

  const categoriesPresent = useMemo(() => {
    const set = new Set<EventType>();
    places.forEach((p) => set.add(p.category));
    return PLACE_CATEGORIES.filter((c) => set.has(c));
  }, [places]);

  function toggleCategory(cat: EventType) {
    setSelectedId(null);
    setPlaceCats((prev) => {
      if (prev === "all") {
        const next = new Set(categoriesPresent);
        next.delete(cat);
        return next.size === 0 ? new Set() : next;
      }
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      if (next.size === categoriesPresent.length) return "all";
      return next;
    });
  }

  if (events.length === 0 && places.length === 0) {
    // Distinguish "nothing added" from "stops exist but none could be pinned"
    // so the map never looks broken when a location just failed to geocode.
    if (unpinnedCount > 0) {
      return (
        <div className="map-empty">
          <p className="map-empty-icon" aria-hidden="true">🧭</p>
          <h3>
            Nothing to pin <em>yet</em>
          </h3>
          <p className="map-empty-sub">
            {unpinnedCount} stop{unpinnedCount === 1 ? "" : "s"} {unpinnedCount === 1 ? "has" : "have"} a location we couldn&apos;t place on the map. Edit the stop and pick a suggestion from the location search so it lands here.
          </p>
        </div>
      );
    }
    return (
      <div className="map-empty">
        <p className="map-empty-icon" aria-hidden="true">🗺️</p>
        <h3>
          No pins <em>yet</em>
        </h3>
        <p className="map-empty-sub">
          Add a location to itinerary events, or save places in Collections — they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="map-layout">
      <aside className="map-panel">
        <div className="map-panel-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2>The <em>route</em></h2>
          <div className="sub">
            {events.length} itinerary pin{events.length === 1 ? "" : "s"}
            {places.length > 0 ? ` · ${places.length} collected` : ""}
            {" "}across {dayCount} days
          </div>
          {unpinnedCount > 0 && (
            <p className="map-unpinned-note">
              {unpinnedCount} stop{unpinnedCount === 1 ? "" : "s"} {unpinnedCount === 1 ? "isn't" : "aren't"} pinned yet — pick a location suggestion when editing so we can place {unpinnedCount === 1 ? "it" : "them"}.
            </p>
          )}
        </div>

        <div className="filter-chips">
          <button className={`chip ${activeDay === "all" ? "active" : ""}`} onClick={() => { setActiveDay("all"); setSelectedId(null); }}>
            All
          </button>
          {days.map((d) => (
            <button key={d.id} className={`chip ${activeDay === d.id ? "active" : ""}`} onClick={() => { setActiveDay(d.id); setSelectedId(null); }}>
              {d.label}
            </button>
          ))}
        </div>

        {categoriesPresent.length > 0 && (
          <div className="map-legend" role="group" aria-label="Collection categories">
            <div className="map-legend-label">Collections</div>
            <div className="filter-chips">
              <button
                type="button"
                className={`chip ${placeCats === "all" ? "active" : ""}`}
                onClick={() => { setPlaceCats("all"); setSelectedId(null); }}
              >
                All places
              </button>
              {categoriesPresent.map((cat) => {
                const on = placeCats === "all" || placeCats.has(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`chip legend-chip ${on ? "active" : ""}`}
                    onClick={() => toggleCategory(cat)}
                  >
                    <span
                      className="legend-dot"
                      style={{ "--swatch": TYPE_HEX[cat] } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="map-pin-list">
          {visibleDays.map((d) => (
            <div className="map-day" key={d.id}>
              <div className="day-label">{d.label} · {d.dateShort}</div>
              {d.events.map((ev) => (
                <div
                  key={ev.id}
                  className={`map-pin ${selectedId === ev.id ? "active" : ""}`}
                  onClick={() => setSelectedId(ev.id)}
                >
                  <span className="num" style={{ "--pin-color": TYPE_HEX[ev.type] } as React.CSSProperties}>
                    {ev.globalIdx}
                  </span>
                  <div className="body">
                    <div className="title">{ev.title}</div>
                    <div className="meta">
                      {ev.startTime && <span>{formatTime(ev.startTime, timeFormat)}</span>}
                      {ev.location && <span>{ev.startTime ? " · " : ""}{ev.location}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {places.length > 0 && (
            <div className="map-day">
              <div className="day-label">Collections</div>
              {places
                .filter((p) => placeCats === "all" || placeCats.has(p.category))
                .map((p) => (
                  <div
                    key={p.id}
                    className={`map-pin collection ${selectedId === p.id ? "active" : ""}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span
                      className="num diamond"
                      style={{ "--pin-color": TYPE_HEX[p.category] } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    <div className="body">
                      <div className="title">{p.title}</div>
                      <div className="meta">{p.location ?? p.category}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </aside>

      <div className="map-canvas">
        <LeafletMap
          events={events}
          places={places}
          activeDay={activeDay}
          activeCategories={placeCats}
          selectedId={selectedId}
          showRoute={showRoute}
          onSelect={setSelectedId}
        />

        {activeDay !== "all" && (
          <button className="map-overview-link" onClick={() => { setActiveDay("all"); setSelectedId(null); }}>
            ← Show whole trip
          </button>
        )}

        <div className="map-controls">
          <button className={`map-ctrl ${showRoute ? "active" : ""}`} onClick={() => setShowRoute((r) => !r)} title="Toggle route line">
            {showRoute ? "Route on" : "Route off"}
          </button>
        </div>

        {selectedEvent && (
          <div className="map-card">
            <div className="card-head">
              <div className="main">
                <div className="badge-row"><TypeBadge type={selectedEvent.type} /></div>
                <h3>{selectedEvent.title}</h3>
              </div>
              <button className="icon-btn" onClick={() => setSelectedId(null)} aria-label="Close">
                <Icons.close size={16} />
              </button>
            </div>
            <div className="card-meta">
              {selectedEvent.location && (
                (selectedEvent.type === "flight" || selectedEvent.type === "transport") && selectedEvent.destLocation ? (
                  <span className="row event-route">
                    <Icons.pin size={13} />
                    <RouteLine from={selectedEvent.location} to={selectedEvent.destLocation} />
                  </span>
                ) : (
                  <span className="row">
                    <Icons.pin size={13} /> {selectedEvent.location}
                  </span>
                )
              )}
              {selectedEvent.startTime && (
                <span className="row mono">
                  <Icons.clock size={13} /> {formatTime(selectedEvent.startTime, timeFormat)}{selectedEvent.endTime ? ` → ${formatTime(selectedEvent.endTime, timeFormat)}` : ""}
                </span>
              )}
              <span className="row day">
                {selectedEvent.dayLabel} · {selectedEvent.dayDate}
              </span>
              {selectedEvent.cost != null && (
                <span className="row"><span className="cost">{formatMoney(selectedEvent.cost, currency)}</span></span>
              )}
            </div>
            {selectedEvent.notes && <div className="note">&ldquo;{selectedEvent.notes}&rdquo;</div>}
          </div>
        )}

        {selectedPlace && !selectedEvent && (
          <div className="map-card">
            <div className="card-head">
              <div className="main">
                <div className="badge-row">
                  <TypeBadge type={selectedPlace.category} />
                  <span className="collection-tag">Collection</span>
                </div>
                <h3>{selectedPlace.title}</h3>
              </div>
              <button className="icon-btn" onClick={() => setSelectedId(null)} aria-label="Close">
                <Icons.close size={16} />
              </button>
            </div>
            <div className="card-meta">
              {selectedPlace.location && (
                <span className="row">
                  <Icons.pin size={13} /> {selectedPlace.location}
                </span>
              )}
            </div>
            {selectedPlace.notes && <div className="note">&ldquo;{selectedPlace.notes}&rdquo;</div>}
          </div>
        )}
      </div>
    </div>
  );
}
